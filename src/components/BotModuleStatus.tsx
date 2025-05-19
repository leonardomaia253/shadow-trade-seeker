
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle, Clock, Activity, Info, HelpCircle, XCircle, Tool, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ModuleStatus {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'inactive' | 'needs_fix';
  health?: 'ok' | 'error' | 'warning' | 'inactive' | 'needs_fix';
  lastChecked?: Date;
  details?: any;
  silentErrors?: Array<{message: string, timestamp: string, code?: string}>;
  needsAttention?: boolean;
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
        // Try to get status from edge function first (preferred method with enhanced data)
        try {
          const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
            body: { action: 'status' }
          });
          
          if (!error && data && data.moduleStatus) {
            // Process moduleStatus from edge function response
            const moduleArray: ModuleStatus[] = Object.entries(data.moduleStatus).map(([name, details]: [string, any]) => ({
              name,
              status: details.status || 'inactive',
              health: details.health || 'inactive',
              lastChecked: details.lastChecked ? new Date(details.lastChecked) : undefined,
              details: details.details,
              silentErrors: details.silentErrors || [],
              needsAttention: details.needsAttention
            }));
            
            setModules(moduleArray);
            setLastUpdated(new Date());
            setLoading(false);
            return;
          }
        } catch (functionError) {
          console.warn('Error fetching from edge function, falling back to direct DB query', functionError);
        }

        // Fallback to direct database query
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
              // Check for health status in metadata first, then fallback to derived status
              const health = log.metadata?.health || getHealthFromLog(log);
              
              moduleMap.set(moduleName, {
                name: moduleName,
                status: log.metadata?.status || getStatusFromLog(log),
                health: health,
                lastChecked: new Date(log.timestamp),
                details: log.metadata,
                silentErrors: log.metadata?.silent_errors || [],
                needsAttention: health === 'needs_fix'
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
                health: 'inactive',
                lastChecked: undefined
              });
            }
          });
          
          setModules(Array.from(moduleMap.values()));
        } else {
          // No logs found, set default module statuses
          setModules([
            { name: 'watcher', status: 'inactive', health: 'inactive' },
            { name: 'scanner', status: 'inactive', health: 'inactive' },
            { name: 'builder', status: 'inactive', health: 'inactive' },
            { name: 'executor', status: 'inactive', health: 'inactive' }
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
            
            // Check for health status in metadata first, then fallback to derived status
            const health = log.metadata?.health || getHealthFromLog(log);
            
            if (moduleIndex !== -1) {
              // Update existing module
              const updated = [...prev];
              updated[moduleIndex] = {
                ...updated[moduleIndex],
                status: log.metadata?.status || getStatusFromLog(log),
                health: health,
                lastChecked: new Date(log.timestamp),
                details: log.metadata,
                silentErrors: log.metadata?.silent_errors || [],
                needsAttention: health === 'needs_fix'
              };
              return updated;
            } else {
              // Add new module
              return [
                ...prev,
                {
                  name: moduleName,
                  status: log.metadata?.status || getStatusFromLog(log),
                  health: health,
                  lastChecked: new Date(log.timestamp),
                  details: log.metadata,
                  silentErrors: log.metadata?.silent_errors || [],
                  needsAttention: health === 'needs_fix'
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

  // Helper function to determine health status from log
  const getHealthFromLog = (log: any): 'ok' | 'error' | 'warning' | 'inactive' | 'needs_fix' => {
    if (!log) return 'inactive';
    
    // Check for silent errors in metadata that would require fixing
    if (log.metadata?.silent_errors && log.metadata.silent_errors.length > 0) {
      return 'needs_fix';
    }
    
    if (log.level === 'error' || log.level === 'critical') {
      return 'error';
    } else if (log.level === 'warn') {
      return 'warning';
    } else if (log.level === 'info' || log.level === 'debug') {
      return 'ok';
    }
    
    return 'inactive';
  };

  // Get status icon based on health (not just status)
  const getStatusIcon = (module: ModuleStatus) => {
    const health = module.health || module.status;
    
    switch (health) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'needs_fix':
        return <Tool className="h-5 w-5 text-orange-500" />;
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

  // Get status label text based on health
  const getStatusLabel = (module: ModuleStatus): string => {
    const health = module.health || module.status;
    
    switch (health) {
      case 'ok':
        return 'OK';
      case 'error':
        return 'ERROR';
      case 'warning':
        return 'WARNING';
      case 'needs_fix':
        return 'NEEDS FIX';
      default:
        return 'INACTIVE';
    }
  };

  // Get status badge color based on health
  const getStatusBadgeClass = (module: ModuleStatus): string => {
    const health = module.health || module.status;
    
    switch (health) {
      case 'ok':
        return 'bg-green-500/80';
      case 'error':
        return 'bg-red-500/80';
      case 'warning':
        return 'bg-yellow-500/80';
      case 'needs_fix':
        return 'bg-orange-500/80';
      default:
        return 'bg-gray-500/80';
    }
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
                className={`p-3 border rounded-md flex flex-col items-center justify-center
                  ${module.needsAttention 
                    ? 'border-orange-500 bg-orange-900/20 animate-pulse' 
                    : 'border-crypto-border bg-crypto-darker/30'}`}
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center mb-2">
                    {getStatusIcon(module)}
                  </div>
                  
                  <h3 className="text-sm font-semibold capitalize">{module.name}</h3>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={`mt-1 ${getStatusBadgeClass(module)}`}>
                          {getStatusLabel(module)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs" side="bottom">
                        <div>
                          <p className="font-bold">Last Check: {getTimeElapsed(module.lastChecked)}</p>
                          
                          {module.silentErrors && module.silentErrors.length > 0 && (
                            <div className="mt-2">
                              <p className="font-bold text-orange-400 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-1" /> 
                                Silent Errors Detected: {module.silentErrors.length}
                              </p>
                              <ul className="text-xs mt-1 max-h-24 overflow-y-auto">
                                {module.silentErrors.slice(0, 3).map((error, idx) => (
                                  <li key={idx} className="text-orange-300 mb-1">
                                    • {error.message}
                                  </li>
                                ))}
                                {module.silentErrors.length > 3 && (
                                  <li className="text-orange-300">• ...and {module.silentErrors.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                          
                          {module.details && (
                            <pre className="text-xs mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {JSON.stringify(module.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {module.needsAttention && (
                    <div className="mt-2">
                      <span className="text-xs text-orange-400 flex items-center">
                        <Tool className="h-3 w-3 mr-1" /> Needs attention
                      </span>
                    </div>
                  )}
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
