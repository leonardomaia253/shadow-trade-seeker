
// Cliente para interagir com a API PM2 real em produção
export class PM2ApiClient {
  private baseUrl: string
  private apiKey: string
  
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }
  
  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    }
    
    try {
      console.log(`[PM2ApiClient] Sending ${method} request to ${this.baseUrl}${endpoint}`)
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[PM2ApiClient] Error response (${response.status}): ${errorText}`)
        throw new Error(`PM2 API Error (${response.status}): ${errorText}`)
      }
      
      const data = await response.json()
      console.log(`[PM2ApiClient] Successful response from ${endpoint}`)
      return data
    } catch (error) {
      console.error(`[PM2ApiClient] Request Error: ${error.message}`)
      if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        throw new Error(`Cannot connect to PM2 API server. Please check that the server is running and accessible at ${this.baseUrl}`)
      }
      throw error
    }
  }
  
  // Métodos para interagir com a API PM2 real
  
  async listProcesses() {
    return this.request('/processes')
  }
  
  async getProcessStatus(processName: string) {
    try {
      return this.request(`/processes/${processName}/status`)
    } catch (error) {
      console.error(`Error getting status for ${processName}:`, error.message)
      // Return a fallback status object when there's an error
      return {
        status: 'unknown',
        error: error.message,
        name: processName
      }
    }
  }
  
  async startProcess(processName: string, options?: { env?: Record<string, string>, script?: string }) {
    return this.request(`/processes/${processName}/start`, 'POST', options)
  }
  
  async stopProcess(processName: string) {
    return this.request(`/processes/${processName}/stop`, 'POST')
  }
  
  async restartProcess(processName: string) {
    return this.request(`/processes/${processName}/restart`, 'POST')
  }
  
  async getLogs(processName: string, options?: { lines?: number }) {
    try {
      return this.request(`/processes/${processName}/logs${options?.lines ? `?lines=${options.lines}` : ''}`)
    } catch (error) {
      console.error(`Error getting logs for ${processName}:`, error.message)
      // Return a fallback logs object when there's an error
      return {
        success: false,
        name: processName,
        logs: `Error retrieving logs: ${error.message}`,
        error: error.message
      }
    }
  }
  
  async setEnv(processName: string, env: Record<string, string>) {
    return this.request(`/processes/${processName}/env`, 'POST', { env })
  }
  
  // Check server health
  async checkHealth() {
    try {
      return this.request('/health')
    } catch (error) {
      console.error('PM2 API server health check failed:', error.message)
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}
