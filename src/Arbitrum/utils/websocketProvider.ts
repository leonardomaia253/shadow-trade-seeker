
import { ethers } from "ethers";
import { WebSocketProvider } from "@ethersproject/providers";

interface ReconnectingWebSocketProviderOptions {
  urls: string[];         // Multiple URLs for fallback
  timeout?: number;       // Connection timeout in ms
  maxRetries?: number;    // Max number of connection retries
  reconnectDelay?: number; // Base delay for reconnection attempts
  maxReconnectDelay?: number; // Maximum delay for reconnection
  heartbeatInterval?: number; // Interval for connection health checks
  onConnect?: () => void; // Callback when connected
  onDisconnect?: () => void; // Callback when disconnected
  onReconnect?: () => void; // Callback when reconnected
  onError?: (error: Error) => void; // Callback on error
}

/**
 * Enhanced WebSocket provider with automatic reconnection and fallback URLs
 */
export class ReconnectingWebSocketProvider {
  private provider: ethers.providers.WebSocketProvider | null = null;
  private options: Required<ReconnectingWebSocketProviderOptions>;
  private currentUrlIndex = 0;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;
  private listeners: Record<string, ethers.providers.Listener[]> = {};

  constructor(options: ReconnectingWebSocketProviderOptions) {
    // Set default options
    this.options = {
      urls: options.urls,
      timeout: options.timeout || 10000,
      maxRetries: options.maxRetries || 10,
      reconnectDelay: options.reconnectDelay || 1000,
      maxReconnectDelay: options.maxReconnectDelay || 60000,
      heartbeatInterval: options.heartbeatInterval || 30000,
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onReconnect: options.onReconnect || (() => {}),
      onError: options.onError || (() => {})
    };

    // Initial connection
    this.connect();
  }

  /**
   * Get the current provider instance
   */
  public get instance(): ethers.providers.WebSocketProvider {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    return this.provider;
  }

  /**
   * Checks if the provider is currently connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Connect to WebSocket provider
   */
  private connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Clear any existing heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Select URL (cycling through available options)
    const url = this.options.urls[this.currentUrlIndex];
    
    try {
      console.log(`🔌 Connecting to WebSocket provider: ${url}`);
      
      // Create new provider
      this.provider = new ethers.providers.WebSocketProvider(url);
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error("WebSocket connection timeout");
          this.handleDisconnect(new Error("Connection timeout"));
        }
      }, this.options.timeout);

      // Listen for network events
      this.provider._websocket.on("open", () => {
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        console.log(`✅ Connected to WebSocket provider: ${url}`);
        
        // Restore event listeners
        this.restoreEventListeners();
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Trigger connect callback
        this.options.onConnect();
      });

      this.provider._websocket.on("close", () => {
        this.handleDisconnect(new Error("WebSocket closed"));
      });

      this.provider._websocket.on("error", (error: Error) => {
        this.options.onError(error);
        this.handleDisconnect(error);
      });

    } catch (error: any) {
      this.handleDisconnect(error);
    }
  }

  /**
   * Handle disconnection and reconnection logic
   */
  private handleDisconnect(error: Error): void {
    if (!this.isConnecting && !this.isConnected) return;

    console.error(`❌ WebSocket disconnected: ${error.message}`);
    
    this.isConnected = false;
    this.isConnecting = false;
    
    // Call disconnection callback
    this.options.onDisconnect();

    // Clear heartbeat if any
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clean up provider
    if (this.provider && this.provider._websocket) {
      this.provider._websocket.removeAllListeners();
      // Force close the websocket if it's still open
      if (this.provider._websocket.readyState === WebSocket.OPEN) {
        this.provider._websocket.close();
      }
    }

    // Try the next URL on the list
    this.currentUrlIndex = (this.currentUrlIndex + 1) % this.options.urls.length;
    
    // Reconnect with exponential backoff
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts <= this.options.maxRetries) {
      const delay = Math.min(
        this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
        this.options.maxReconnectDelay
      );
      
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxRetries})`);
      
      // Clear any existing reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      
      // Set new reconnect timer
      this.reconnectTimer = setTimeout(() => {
        this.options.onReconnect();
        this.connect();
      }, delay);
    } else {
      console.error(`❌ Max reconnection attempts reached (${this.options.maxRetries}). Giving up.`);
    }
  }

  /**
   * Start heartbeat checks to verify connection health
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(async () => {
      if (!this.provider) return;
      
      try {
        // Simple health check by requesting block number
        await this.provider.getBlockNumber();
      } catch (error) {
        console.error("❌ Heartbeat check failed:", error);
        this.handleDisconnect(new Error("Heartbeat failed"));
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Store event listeners to restore them after reconnection
   */
  public on(eventName: string, listener: ethers.providers.Listener): void {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    
    // Store the listener for later restoration
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
    
    // Add to the current provider
    this.provider.on(eventName, listener);
  }

  /**
   * Remove an event listener
   */
  public off(eventName: string, listener: ethers.providers.Listener): void {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }
    
    // Remove from our stored listeners
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(l => l !== listener);
    }
    
    // Remove from current provider
    this.provider.off(eventName, listener);
  }

  /**
   * Restore event listeners after reconnection
   */
  private restoreEventListeners(): void {
    if (!this.provider) return;
    
    // Re-attach all stored listeners to the new provider instance
    for (const eventName in this.listeners) {
      for (const listener of this.listeners[eventName]) {
        this.provider.on(eventName, listener);
      }
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.provider && this.provider._websocket) {
      this.provider._websocket.removeAllListeners();
      if (this.provider._websocket.readyState === WebSocket.OPEN) {
        this.provider._websocket.close();
      }
    }
    
    this.listeners = {};
    this.isConnected = false;
    this.isConnecting = false;
  }
}

/**
 * Create a reconnecting WebSocket provider with multiple fallback URLs
 */
export function createReconnectingProvider(
  urls: string | string[],
  options: Omit<ReconnectingWebSocketProviderOptions, 'urls'> = {}
): ReconnectingWebSocketProvider {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  
  return new ReconnectingWebSocketProvider({
    urls: urlArray,
    ...options
  });
}
