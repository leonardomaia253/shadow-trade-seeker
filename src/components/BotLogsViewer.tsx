
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, AlertTriangle, AlertCircle, Bug, Activity, Database, Settings, Code } from "lucide-react";

interface Log {
  id: string;
  level: string; 
  message: string;
  category: string;
  timestamp: string;
  source?: string;
  tx_hash?: string;
  metadata?: any;
}

interface BotLogsViewerProps {
  botType?: string;  // Optional, to filter logs for a specific bot
  maxLogs?: number;  // Optional, to limit the number of logs
}

const BotLogsViewer = ({ botType = 'arbitrage', maxLogs = 10 }: BotLogsViewerProps) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Function to fetch logs
    const fetchLogs = async () => {
      try {
        let query = supabase
          .from('bot_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(maxLogs);
        
        if (botType) {
          query = query.eq('bot_type', botType);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
          setLogs(data);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`logs-channel-${botType}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: botType ? `bot_type=eq.${botType}` : undefined }, 
        (payload) => {
          setLogs(prevLogs => [payload.new as Log, ...prevLogs.slice(0, maxLogs - 1)]);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botType, maxLogs]);
  
  // Function to get icon based on log level
  const getLogLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-400" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-green-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };
  
  // Function to get icon based on category
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'bot_state':
        return <Activity className="h-4 w-4" />;
      case 'transaction':
        return <Database className="h-4 w-4" />;
      case 'configuration':
        return <Settings className="h-4 w-4" />;
      case 'user_action':
        return <Info className="h-4 w-4" />;
      case 'code':
        return <Code className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center">
          <Activity className="mr-2" /> Bot Logs
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-muted-foreground">Loading logs...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">No logs to display</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className="p-2 border-b border-crypto-border last:border-0 hover:bg-crypto-darker/30 transition-colors"
              >
                <div className="flex items-start">
                  <div className="mr-2 mt-1">{getLogLevelIcon(log.level)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">{log.message}</p>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="flex items-center mt-1 text-xs text-muted-foreground">
                      {getCategoryIcon(log.category)}
                      <span className="ml-1 mr-2">{log.category}</span>
                      {log.source && (
                        <span className="mr-2">from: {log.source}</span>
                      )}
                      {log.tx_hash && (
                        <span className="truncate max-w-sm">tx: {log.tx_hash.substring(0, 10)}...</span>
                      )}
                    </div>
                    {log.metadata && (
                      <details className="mt-1">
                        <summary className="text-xs text-neon-blue cursor-pointer">Details</summary>
                        <pre className="text-xs bg-crypto-darker p-2 mt-1 rounded overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BotLogsViewer;
