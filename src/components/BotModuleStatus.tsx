
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle, Clock, Activity, Info, HelpCircle, XCircle } from 'lucide-react';

interface ModuleStatus {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'inactive';
  lastChecked?: Date;
  details?: any;
}

interface BotModuleStatusProps {
  botType: string;
  refreshInterval?: number;
}

const BotModuleStatus: React.FC<BotModuleStatusProps> = ({ botType, refreshInterval = 5000 }) => {
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const fetchModuleStatus = async () => {
      try {
        // Get most recent logs for each module to determine status
        const { data: logs, error } = await supabase
          .from('bot_logs')
          .select('*')
          .eq('bot_type', botType)
          .eq('category', 'health_check')
          .order('timestamp', { ascending: false });

        if (error) throw error;

        if (logs && logs.length > 0) {
          // Process logs to get latest status for each module
          const moduleMap = new Map<string, ModuleStatus>();
          
          logs.forEach(log => {
            const moduleName = log.source || 'unknown';
            
            // Only add if we haven't seen this module yet (since logs are ordered by timestamp desc)
            if (!moduleMap.has(moduleName)) {
              moduleMap.set(moduleName, {
                name: moduleName,
                status: getStatusFromLog(log),
                lastChecked: new Date(log.timestamp),
                details: log.metadata
              });
            }
          });
          
          // Add known modules even if they're not found in logs
          const knownModules = ['scanner', 'watcher', 'builder', 'executor'];
          knownModules.forEach(module => {
            if (!moduleMap.has(module)) {
              moduleMap.set(module, {
                name: module,
                status: 'inactive',
                lastChecked: undefined
              });
            }
          });
          
          setModules(Array.from(moduleMap.values()));
        } else {
          // No logs found, set default module statuses
          setModules([
            { name: 'watcher', status: 'inactive' },
            { name: 'scanner', status: 'inactive' },
            { name: 'builder', status: 'inactive' },
            { name: 'executor', status: 'inactive' }
          ]);
        }
        
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching module status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch initial status
    fetchModuleStatus();

    // Set up auto-refresh
    const intervalId = setInterval(fetchModuleStatus, refreshInterval);
    
    // Set up real-time subscription for health check updates
    const channel = supabase
      .channel(`module-status-${botType}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `bot_type=eq.${botType} AND category=eq.health_check` }, 
        (payload) => {
          // Update module status on new health check
          const log = payload.new;
          const moduleName = log.source || 'unknown';
          
          setModules(prev => {
            // Find the module in the current state
            const moduleIndex = prev.findIndex(m => m.name === moduleName);
            
            if (moduleIndex !== -1) {
              // Update existing module
              const updated = [...prev];
              updated[moduleIndex] = {
                ...updated[moduleIndex],
                status: getStatusFromLog(log),
                lastChecked: new Date(log.timestamp),
                details: log.metadata
              };
              return updated;
            } else {
              // Add new module
              return [
                ...prev,
                {
                  name: moduleName,
                  status: getStatusFromLog(log),
                  lastChecked: new Date(log.timestamp),
                  details: log.metadata
                }
              ];
            }
          });
          
          setLastUpdated(new Date());
        }
      )
      .subscribe();
    
    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [botType, refreshInterval]);

  // Helper function to determine status from log
  const getStatusFromLog = (log: any): 'ok' | 'error' | 'warning' | 'inactive' => {
    if (!log) return 'inactive';
    
    if (log.level === 'error' || log.level === 'critical') {
      return 'error';
    } else if (log.level === 'warn') {
      return 'warning';
    } else if (log.level === 'info' || log.level === 'debug') {
      return 'ok';
    }
    
    return 'inactive';
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format time elapsed
  const getTimeElapsed = (date?: Date): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <Activity className="mr-2" /> Bot Modules Status
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-pulse text-muted-foreground">Checking module status...</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {modules.map((module) => (
              <div 
                key={module.name}
                className="p-3 border border-crypto-border rounded-md bg-crypto-darker/30 flex flex-col items-center justify-center"
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center mb-2">
                    {getStatusIcon(module.status)}
                  </div>
                  
                  <h3 className="text-sm font-semibold capitalize">{module.name}</h3>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={`mt-1 ${
                          module.status === 'ok' ? 'bg-green-500/80' : 
                          module.status === 'error' ? 'bg-red-500/80' : 
                          module.status === 'warning' ? 'bg-yellow-500/80' : 
                          'bg-gray-500/80'
                        }`}>
                          {module.status.toUpperCase()}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div>
                          <p className="font-bold">Last Check: {getTimeElapsed(module.lastChecked)}</p>
                          {module.details && (
                            <pre className="text-xs mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {JSON.stringify(module.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BotModuleStatus;
