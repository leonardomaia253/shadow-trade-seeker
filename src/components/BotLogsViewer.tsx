
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertCircle, Info, Check, ChevronDown } from "lucide-react";

interface BotLogEntry {
  id: string;
  level: string;
  message: string;
  category: string;
  timestamp: string;
  source?: string;
  bot_type?: string;
  metadata?: any;
}

interface BotLogsViewerProps {
  botType?: string;
}

const BotLogsViewer = ({ botType = 'arbitrage' }: BotLogsViewerProps) => {
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logLevel, setLogLevel] = useState<string>("all");
  
  useEffect(() => {
    // Function to fetch logs
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('bot_logs')
          .select('*')
          .eq('bot_type', botType)
          .order('timestamp', { ascending: false })
          .limit(100);
          
        if (logLevel !== 'all') {
          query = query.eq('level', logLevel);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        setLogs(data || []);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Initial fetch
    fetchLogs();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`${botType}-logs-updates`)
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `bot_type=eq.${botType}` },
          (payload) => {
            const newLog = payload.new as BotLogEntry;
            
            // Add the new log only if it matches our current log level filter
            if (logLevel === 'all' || newLog.level === logLevel) {
              setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 99)]);
            }
          })
      .subscribe();
      
    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botType, logLevel]);
  
  // Function to get color and icon based on log level
  const getLevelStyles = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return { color: 'text-red-500', icon: <AlertCircle className="h-4 w-4 mr-1" /> };
      case 'warn':
        return { color: 'text-yellow-500', icon: <AlertCircle className="h-4 w-4 mr-1" /> };
      case 'info':
        return { color: 'text-neon-blue', icon: <Info className="h-4 w-4 mr-1" /> };
      case 'success':
        return { color: 'text-neon-green', icon: <Check className="h-4 w-4 mr-1" /> };
      default:
        return { color: 'text-gray-400', icon: <Activity className="h-4 w-4 mr-1" /> };
    }
  };
  
  // Format timestamp to localized time
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
             ' ' + date.toLocaleDateString();
    } catch (e) {
      return timestamp;
    }
  };
  
  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <Activity className="mr-2" /> Bot Logs
        </CardTitle>
        <Select
          value={logLevel}
          onValueChange={setLogLevel}
        >
          <SelectTrigger className="w-32 bg-crypto-darker">
            <SelectValue placeholder="Log Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warnings</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-80 overflow-auto border border-crypto-border rounded-md bg-crypto-darker p-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <span className="text-neon-blue animate-pulse">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-400">
              <span>No logs found</span>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => {
                const { color, icon } = getLevelStyles(log.level);
                return (
                  <div 
                    key={log.id} 
                    className="p-2 border-b border-crypto-border last:border-b-0 hover:bg-black/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`flex items-center font-bold ${color}`}>
                        {icon}
                        <span>{log.level.toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="mt-1 text-sm">{log.message}</div>
                    <div className="mt-1 flex items-center text-xs text-gray-400">
                      <span className="bg-crypto-darker px-2 py-0.5 rounded">{log.category}</span>
                      {log.source && (
                        <span className="ml-2 bg-crypto-darker px-2 py-0.5 rounded">
                          Source: {log.source}
                        </span>
                      )}
                    </div>
                    {log.metadata && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer flex items-center text-gray-400 hover:text-gray-300">
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Details
                        </summary>
                        <div className="p-2 mt-1 bg-crypto-darker rounded overflow-x-auto">
                          <pre className="text-xs text-gray-300">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BotLogsViewer;
