import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, Circle, Clock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface ModuleStatus {
  module: string;
  status: 'online' | 'offline' | 'warning' | 'initializing';
  lastUpdate: string;
  errors?: number;
  lastMessage?: string;
  errorMessages?: string[];
}

interface ModuleStatsData {
  successRate?: number;
  errorRate?: number;
  scanCount?: number;
  processCount?: number;
  timestamp?: string;
}

interface BotModuleStatusProps {
  botType: string;
  isRunning: boolean;
}

const BotModuleStatus: React.FC<BotModuleStatusProps> = ({ botType, isRunning }) => {
  const [moduleStatuses, setModuleStatuses] = useState<ModuleStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStatsData>>({});

  // Common modules for all bot types
  const defaultModules = {
    'frontrun': ['watcher', 'builder', 'executor'],
    'sandwich': ['scanner', 'builder', 'executor'],
    'arbitrage': ['scanner', 'builder', 'executor'],
    'liquidation': ['scanner', 'builder', 'executor'],
    'profiter-one': ['scanner', 'builder', 'executor'],
    'profiter-two': ['scanner', 'builder', 'simulator', 'executor']
  };

  // Initialize module statuses
  useEffect(() => {
    if (!botType) return;

    const modules = defaultModules[botType as keyof typeof defaultModules] || ['scanner', 'builder', 'executor'];
    
    const initialStatuses: ModuleStatus[] = modules.map(module => ({
      module,
      status: 'offline',
      lastUpdate: new Date().toISOString(),
      errors: 0
    }));

    setModuleStatuses(initialStatuses);
    
    // Initial data fetch
    fetchModuleStatuses();
    
    // Set up real-time subscription for module updates
    const channel = supabase
      .channel('bot-module-status-changes')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: `bot_type=eq.${botType}` },
          (payload) => {
            updateModuleStatus(payload.new);
          })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botType]);

  // Fetch initial status data
  const fetchModuleStatuses = async () => {
    if (!botType) return;
    
    setIsLoading(true);
    
    try {
      // Get the latest log entry for each module
      const { data: moduleLogsData, error: moduleLogsError } = await supabase
        .from('bot_logs')
        .select('*')
        .eq('bot_type', botType)
        .order('timestamp', { ascending: false })
        .limit(100);
        
      if (moduleLogsError) throw moduleLogsError;
      
      if (moduleLogsData && moduleLogsData.length > 0) {
        processLogData(moduleLogsData);
      }
      
    } catch (error) {
      console.error('Error fetching module status:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process log data to update module statuses
  const processLogData = (logs: any[]) => {
    if (!logs || logs.length === 0) return;
    
    // Get modules for this bot type
    const modules = defaultModules[botType as keyof typeof defaultModules] || ['scanner', 'builder', 'executor'];
    
    // Create an object to store the most recent status for each module
    const moduleData: Record<string, any> = {};
    
    // Group stats by module
    const stats: Record<string, ModuleStatsData> = {};
    
    // Process logs to extract status and stats
    logs.forEach(log => {
      const module = log.source;
      
      // Skip system logs and non-module specific logs
      if (!module || module === 'system' || module === 'main' || !modules.includes(module)) {
        return;
      }
      
      // Initialize module data if not exists
      if (!moduleData[module]) {
        moduleData[module] = {
          lastUpdate: log.timestamp,
          status: 'offline',
          errors: 0,
          errorMessages: [],
        };
      }
      
      // Initialize module stats if not exists
      if (!stats[module]) {
        stats[module] = {
          successRate: 0,
          errorRate: 0,
          scanCount: 0,
          processCount: 0,
        };
      }
      
      // Update module data based on log entry
      if (log.level === 'error' || log.level === 'critical') {
        moduleData[module].errors = (moduleData[module].errors || 0) + 1;
        moduleData[module].status = 'warning';
        
        if (log.message) {
          if (!moduleData[module].errorMessages) {
            moduleData[module].errorMessages = [];
          }
          // Only keep the 5 most recent error messages
          moduleData[module].errorMessages = [
            log.message,
            ...(moduleData[module].errorMessages || []).slice(0, 4)
          ];
        }
        
        // Update stats
        stats[module].errorRate = (stats[module].errorRate || 0) + 1;
      } 
      else if (log.level === 'info' && log.category === 'module_status') {
        // This is a status update
        if (log.metadata?.status === 'initializing') {
          moduleData[module].status = 'initializing';
        } else {
          moduleData[module].status = 'online';
        }
        
        if (log.metadata) {
          if (log.metadata.scanCount) stats[module].scanCount = log.metadata.scanCount;
          if (log.metadata.processCount) stats[module].processCount = log.metadata.processCount;
          if (log.metadata.successRate) stats[module].successRate = log.metadata.successRate;
        }
      }
      else {
        // Regular activity log
        moduleData[module].status = 'online';
        moduleData[module].lastMessage = log.message;
        
        // Update stats
        stats[module].processCount = (stats[module].processCount || 0) + 1;
      }
    });
    
    // Convert to array and set state
    const statuses: ModuleStatus[] = modules.map(module => {
      const data = moduleData[module] || {
        status: 'offline',
        lastUpdate: new Date().toISOString(),
        errors: 0
      };
      
      // If the bot is not running, set all modules to offline
      if (!isRunning) {
        data.status = 'offline';
      }
      
      return {
        module,
        status: data.status,
        lastUpdate: data.lastUpdate,
        errors: data.errors || 0,
        lastMessage: data.lastMessage,
        errorMessages: data.errorMessages
      };
    });
    
    setModuleStatuses(statuses);
    setModuleStats(stats);
  };
  
  // Update module status from real-time data
  const updateModuleStatus = (logEntry: any) => {
    if (!logEntry || !logEntry.source) return;
    
    const module = logEntry.source;
    
    // Update module statuses
    setModuleStatuses(prev => {
      const moduleIndex = prev.findIndex(m => m.module === module);
      
      if (moduleIndex === -1) return prev;
      
      const updatedStatuses = [...prev];
      const currentStatus = {...updatedStatuses[moduleIndex]};
      
      // Update status based on log entry
      if (logEntry.level === 'error' || logEntry.level === 'critical') {
        currentStatus.errors = (currentStatus.errors || 0) + 1;
        currentStatus.status = 'warning';
        
        if (logEntry.message) {
          if (!currentStatus.errorMessages) {
            currentStatus.errorMessages = [];
          }
          // Only keep the 5 most recent error messages
          currentStatus.errorMessages = [
            logEntry.message,
            ...(currentStatus.errorMessages || []).slice(0, 4)
          ];
        }
      } 
      else if (logEntry.level === 'info' && logEntry.category === 'module_status') {
        if (logEntry.metadata?.status === 'initializing') {
          currentStatus.status = 'initializing';
        } else {
          currentStatus.status = 'online';
        }
      }
      else {
        // Regular activity log
        currentStatus.status = 'online';
        currentStatus.lastMessage = logEntry.message;
      }
      
      currentStatus.lastUpdate = logEntry.timestamp;
      
      // If bot is not running, keep status as offline
      if (!isRunning) {
        currentStatus.status = 'offline';
      }
      
      updatedStatuses[moduleIndex] = currentStatus;
      return updatedStatuses;
    });
    
    // Update module stats
    if (logEntry.metadata) {
      setModuleStats(prev => {
        const updatedStats = {...prev};
        const currentStats = {...(updatedStats[module] || {})};
        
        if (logEntry.level === 'error' || logEntry.level === 'critical') {
          currentStats.errorRate = (currentStats.errorRate || 0) + 1;
        }
        
        if (logEntry.category === 'scan') {
          currentStats.scanCount = (currentStats.scanCount || 0) + 1;
        }
        
        if (logEntry.category === 'execution' || logEntry.category === 'build') {
          currentStats.processCount = (currentStats.processCount || 0) + 1;
        }
        
        if (logEntry.metadata.successRate) currentStats.successRate = logEntry.metadata.successRate;
        if (logEntry.metadata.scanCount) currentStats.scanCount = logEntry.metadata.scanCount;
        if (logEntry.metadata.processCount) currentStats.processCount = logEntry.metadata.processCount;
        
        currentStats.timestamp = logEntry.timestamp;
        
        updatedStats[module] = currentStats;
        return updatedStats;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'online':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <Circle className="h-5 w-5 text-gray-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'initializing':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'offline':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'initializing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse p-4 bg-crypto-dark rounded-lg border border-gray-700">
        <div className="h-5 bg-gray-700 rounded w-1/4 mb-3"></div>
        <div className="flex space-x-2">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-crypto-dark border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Module Status</h3>
      <div className="flex flex-wrap gap-2">
        {moduleStatuses.map((module) => (
          <Tooltip key={module.module}>
            <TooltipTrigger asChild>
              <div 
                className={`flex items-center space-x-1 px-2 py-1 rounded-full border cursor-help ${getStatusColor(module.status)}`}
              >
                {getStatusIcon(module.status)}
                <span className="text-xs font-medium capitalize">{module.module}</span>
                {module.errors > 0 && (
                  <Badge variant="destructive" className="h-4 w-4 flex items-center justify-center text-[10px] p-0">
                    {module.errors}
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs p-2 bg-gray-800 border-gray-700 text-white text-xs">
              <div className="mb-1">
                <strong>Status:</strong> <span className="capitalize">{module.status}</span>
              </div>
              <div className="mb-1">
                <strong>Last update:</strong> {new Date(module.lastUpdate).toLocaleTimeString()}
              </div>
              {module.errors > 0 && (
                <div className="text-red-400">
                  <strong>Error count:</strong> {module.errors}
                  {module.errorMessages && module.errorMessages.length > 0 && (
                    <div className="mt-1 text-[10px] max-h-24 overflow-y-auto">
                      <strong>Latest errors:</strong>
                      <ul className="list-disc list-inside">
                        {module.errorMessages.map((msg, i) => (
                          <li key={i} className="truncate">{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {module.lastMessage && (
                <div className="mt-1">
                  <strong>Last message:</strong> {module.lastMessage}
                </div>
              )}
              {moduleStats[module.module] && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  {moduleStats[module.module].scanCount !== undefined && (
                    <div className="flex items-center space-x-1">
                      <span><ArrowUpCircle className="h-3 w-3 text-blue-400" /></span>
                      <span>Scans: {moduleStats[module.module].scanCount}</span>
                    </div>
                  )}
                  {moduleStats[module.module].processCount !== undefined && (
                    <div className="flex items-center space-x-1">
                      <span><ArrowDownCircle className="h-3 w-3 text-purple-400" /></span>
                      <span>Processes: {moduleStats[module.module].processCount}</span>
                    </div>
                  )}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </Card>
  );
};

export default BotModuleStatus;
