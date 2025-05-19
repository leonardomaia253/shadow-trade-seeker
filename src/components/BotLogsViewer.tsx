
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, AlertTriangle, AlertCircle, Bug, Activity, Database, Settings, Code, Cpu, Clock, Zap, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Log {
  id: string;
  level: string; 
  message: string;
  category: string;
  timestamp: string;
  source?: string;
  tx_hash?: string;
  metadata?: any;
  bot_type?: string;
}

interface BotLogsViewerProps {
  botType?: string;  // Optional, to filter logs for a specific bot
  maxLogs?: number;  // Optional, to limit the number of logs
  refreshInterval?: number; // Optional, to control refresh rate in ms
}

const BotLogsViewer = ({ botType = 'arbitrage', maxLogs = 20, refreshInterval = 5000 }: BotLogsViewerProps) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedLogIds, setExpandedLogIds] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const toggleExpanded = (id: string) => {
    if (expandedLogIds.includes(id)) {
      setExpandedLogIds(expandedLogIds.filter(logId => logId !== id));
    } else {
      setExpandedLogIds([...expandedLogIds, id]);
    }
  };

  useEffect(() => {
    // Function to fetch logs
    const fetchLogs = async () => {
      try {
        let query = supabase
          .from('bot_logs')
          .select('*')
          .order('timestamp', { ascending: false });
        
        if (botType) {
          query = query.eq('bot_type', botType);
        }
        
        if (activeTab !== 'all') {
          query = query.eq('category', activeTab);
        }
        
        query = query.limit(maxLogs);
        
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
    
    // Set up auto-refresh if enabled
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(fetchLogs, refreshInterval);
    }
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`logs-channel-${botType}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: botType ? `bot_type=eq.${botType}` : undefined }, 
        (payload) => {
          // Only add the log if it matches the current category filter
          const newLog = payload.new as Log;
          if (activeTab === 'all' || newLog.category === activeTab) {
            setLogs(prevLogs => [newLog, ...prevLogs.slice(0, maxLogs - 1)]);
          }
        }
      )
      .subscribe();
      
    return () => {
      if (intervalId) clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [botType, maxLogs, activeTab, autoRefresh, refreshInterval]);
  
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
      case 'critical':
        return <Zap className="h-4 w-4 text-red-600" />;
      case 'state':
        return <Activity className="h-4 w-4 text-purple-400" />;
      case 'perf':
        return <Clock className="h-4 w-4 text-indigo-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-400" />;
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
      case 'system':
        return <Cpu className="h-4 w-4" />;
      case 'exception':
        return <AlertCircle className="h-4 w-4" />;
      case 'api':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  // Get log level badge color
  const getLogLevelBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'info': return 'bg-blue-500 hover:bg-blue-600';
      case 'warn': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'error': return 'bg-red-500 hover:bg-red-600';
      case 'debug': return 'bg-green-500 hover:bg-green-600';
      case 'critical': return 'bg-red-700 hover:bg-red-800';
      case 'state': return 'bg-purple-500 hover:bg-purple-600';
      case 'perf': return 'bg-indigo-500 hover:bg-indigo-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <Activity className="mr-2" /> Bot Logs
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"}
            >
              {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="all" onValueChange={setActiveTab} className="mx-6">
        <TabsList className="grid grid-cols-4 sm:grid-cols-7 mb-2">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="bot_state">State</TabsTrigger>
          <TabsTrigger value="transaction">Tx</TabsTrigger>
          <TabsTrigger value="exception">Errors</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="configuration">Config</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <CardContent className="max-h-96 overflow-y-auto">
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
                className="p-3 border border-crypto-border rounded-md last:border-0 hover:bg-crypto-darker/30 transition-colors"
              >
                <div className="flex items-start">
                  <div className="mr-2 mt-1">{getLogLevelIcon(log.level)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <p className="text-sm font-medium">{log.message}</p>
                        <Badge 
                          className={`ml-2 text-xs ${getLogLevelBadgeColor(log.level)}`}
                        >
                          {log.level}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <div className="flex flex-wrap items-center mt-1 text-xs text-muted-foreground gap-x-2">
                      <div className="flex items-center">
                        {getCategoryIcon(log.category)}
                        <span className="ml-1">{log.category}</span>
                      </div>
                      {log.source && (
                        <span>from: {log.source}</span>
                      )}
                      {log.tx_hash && (
                        <span className="truncate max-w-sm">tx: {log.tx_hash.substring(0, 10)}...</span>
                      )}
                    </div>
                    {log.metadata && (
                      <div className="mt-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleExpanded(log.id)}
                          className="text-xs text-neon-blue p-0 h-6"
                        >
                          {expandedLogIds.includes(log.id) ? 'Hide Details' : 'Show Details'}
                        </Button>
                        {expandedLogIds.includes(log.id) && (
                          <pre className="text-xs bg-crypto-darker p-2 mt-1 rounded overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
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
