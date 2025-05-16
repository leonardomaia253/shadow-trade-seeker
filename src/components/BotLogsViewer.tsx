
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Info, AlertTriangle, Bug, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  category: string;
  bot_type?: string;
  source?: string;
  tx_hash?: string;
  metadata?: any;
  timestamp: string;
}

const LogIcon = ({ level }: { level: string }) => {
  switch (level.toLowerCase()) {
    case 'info':
      return <Info className="h-4 w-4 text-neon-blue" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'debug':
      return <Bug className="h-4 w-4 text-neon-purple" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-neon-green" />;
    default:
      return <Info className="h-4 w-4 text-gray-400" />;
  }
};

const getLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'info':
      return 'bg-blue-900/30 text-neon-blue border-neon-blue/50';
    case 'warn':
      return 'bg-amber-900/30 text-amber-500 border-amber-500/50';
    case 'error':
      return 'bg-red-900/30 text-red-500 border-red-500/50';
    case 'debug':
      return 'bg-purple-900/30 text-neon-purple border-neon-purple/50';
    case 'success':
      return 'bg-green-900/30 text-neon-green border-neon-green/50';
    default:
      return 'bg-gray-900/30 text-gray-400 border-gray-500/50';
  }
};

const BotLogsViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedMetadata, setExpandedMetadata] = useState<{ [key: string]: boolean }>({});

  const toggleLogExpansion = (logId: string) => {
    const newExpandedLogs = new Set(expandedLogIds);
    if (newExpandedLogs.has(logId)) {
      newExpandedLogs.delete(logId);
    } else {
      newExpandedLogs.add(logId);
    }
    setExpandedLogIds(newExpandedLogs);
  };

  const toggleMetadataExpansion = (logId: string) => {
    setExpandedMetadata(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const formatJSON = (data: any): string => {
    if (!data) return 'No metadata';
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return 'Invalid metadata format';
    }
  };

  const openTransactionExplorer = (txHash: string) => {
    window.open(`https://arbiscan.io/tx/${txHash}`, '_blank');
  };

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const query = supabase
          .from('bot_logs')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .order('timestamp', { ascending: false })
          .limit(50);

        if (activeTab !== 'all') {
          query.eq('level', activeTab);
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
    
    // Set up real-time listener for new log entries
    const channel = supabase
      .channel('arbitrage-logs-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            // Add new log to the top of the list
            setLogs(prev => [payload.new as LogEntry, ...prev.slice(0, 49)]);
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const filteredLogs = logs;

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl text-neon-blue flex items-center">
            <Bug className="mr-2" /> Bot Logs
          </CardTitle>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-crypto-darker">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="info" className="text-neon-blue">Info</TabsTrigger>
              <TabsTrigger value="warn" className="text-amber-500">Warn</TabsTrigger>
              <TabsTrigger value="error" className="text-red-500">Error</TabsTrigger>
              <TabsTrigger value="debug" className="text-neon-purple">Debug</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader className="h-8 w-8 text-neon-blue animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No logs available. Start the bot to begin logging activity.
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`border rounded-md overflow-hidden ${getLevelColor(log.level)}`}
                >
                  <div 
                    className="p-3 cursor-pointer flex justify-between items-start"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        <LogIcon level={log.level} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                          </Badge>
                          <Badge className={`uppercase text-xs ${
                            log.level === 'error' ? 'bg-red-900 text-red-200' :
                            log.level === 'warn' ? 'bg-amber-900 text-amber-200' :
                            log.level === 'info' ? 'bg-blue-900 text-blue-200' :
                            log.level === 'debug' ? 'bg-purple-900 text-purple-200' :
                            'bg-gray-800 text-gray-200'
                          }`}>
                            {log.level}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {log.category}
                          </Badge>
                          {log.source && (
                            <Badge variant="outline" className="text-xs">
                              {log.source}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-normal break-words">{log.message}</p>
                      </div>
                    </div>
                    <div className="text-xs opacity-70">
                      {expandedLogIds.has(log.id) ? '−' : '+'}
                    </div>
                  </div>
                  
                  {expandedLogIds.has(log.id) && (
                    <div className="px-3 pb-3 pt-1 border-t border-dashed border-gray-700">
                      {log.tx_hash && (
                        <div className="mb-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              openTransactionExplorer(log.tx_hash!);
                            }}
                            className="text-xs flex items-center gap-1"
                          >
                            View Transaction <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                          <div className="text-xs mt-1 opacity-70 font-mono overflow-hidden text-ellipsis">
                            {log.tx_hash}
                          </div>
                        </div>
                      )}
                      
                      {log.metadata && (
                        <div className="mt-2">
                          <div 
                            className="text-xs font-semibold mb-1 cursor-pointer flex items-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMetadataExpansion(log.id);
                            }}
                          >
                            Metadata {expandedMetadata[log.id] ? '−' : '+'}
                          </div>
                          {expandedMetadata[log.id] && (
                            <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto font-mono">
                              {formatJSON(log.metadata)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default BotLogsViewer;
