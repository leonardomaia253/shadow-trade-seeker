
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Tooltip } from './ui/tooltip';
import { Info, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

// Types for module status
interface ModuleStatus {
  name: string;
  lastActive: string; // ISO date string
  status: 'ok' | 'warning' | 'error' | 'inactive';
  details?: Record<string, any>;
}

interface BotModuleStatusProps {
  botType: string;
  refreshInterval?: number; // in milliseconds
}

export function BotModuleStatus({ botType, refreshInterval = 10000 }: BotModuleStatusProps) {
  // Fetch bot logs to determine module status
  const { data: logs, isLoading } = useQuery({
    queryKey: ['botModuleLogs', botType],
    queryFn: async () => {
      // Get logs from the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('bot_logs')
        .select('*')
        .eq('bot_type', botType)
        .gte('timestamp', fifteenMinutesAgo)
        .order('timestamp', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    refetchInterval: refreshInterval
  });
  
  // Extract module information from logs
  const getModuleStatus = (): ModuleStatus[] => {
    if (!logs || logs.length === 0) return [];
    
    const moduleMap = new Map<string, ModuleStatus>();
    const knownModules = ['scanner', 'builder', 'simulation', 'executor'];
    
    // Initialize known modules
    knownModules.forEach(module => {
      moduleMap.set(module, {
        name: module,
        lastActive: '',
        status: 'inactive'
      });
    });
    
    // Process logs to update module status
    logs.forEach(log => {
      // Skip logs without source
      if (!log.source || log.source === 'system') return;
      
      const module = log.source;
      const currentStatus = moduleMap.get(module) || {
        name: module,
        lastActive: '',
        status: 'inactive'
      };
      
      // Update last active time if newer
      if (!currentStatus.lastActive || new Date(log.timestamp) > new Date(currentStatus.lastActive)) {
        currentStatus.lastActive = log.timestamp;
      }
      
      // Update status based on log level and recency
      if (log.level === 'error' || log.level === 'critical') {
        currentStatus.status = 'error';
      } else if (log.level === 'warn') {
        if (currentStatus.status !== 'error') {
          currentStatus.status = 'warning';
        }
      } else if (log.level === 'info' && currentStatus.status === 'inactive') {
        // Check if log is recent (within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (new Date(log.timestamp) >= fiveMinutesAgo) {
          currentStatus.status = 'ok';
        }
      }
      
      // Store any details from metadata
      if (log.metadata) {
        currentStatus.details = {
          ...(currentStatus.details || {}),
          ...log.metadata
        };
      }
      
      moduleMap.set(module, currentStatus);
    });
    
    return Array.from(moduleMap.values());
  };
  
  const modules = getModuleStatus();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'inactive': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'inactive': return <Clock className="h-4 w-4 text-gray-400" />;
      default: return <Info className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Calculate overall health percentage
  const calculateHealthPercentage = () => {
    if (modules.length === 0) return 0;
    
    const statusScores = {
      'ok': 100,
      'warning': 50,
      'error': 0,
      'inactive': 0
    };
    
    const totalScore = modules.reduce((sum, module) => 
      sum + statusScores[module.status], 0);
      
    return Math.round(totalScore / modules.length);
  };
  
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Bot Modules Status</h3>
        <Badge variant={isLoading ? "outline" : "default"}>
          {isLoading ? "Refreshing..." : "Live"}
        </Badge>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">System Health</span>
          <span className="text-sm">{calculateHealthPercentage()}%</span>
        </div>
        <Progress value={calculateHealthPercentage()} className="h-2" />
      </div>
      
      <Separator className="my-4" />
      
      {modules.length > 0 ? (
        <div className="space-y-4">
          {modules.map((module) => (
            <div key={module.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(module.status)}
                <span className="font-medium capitalize">{module.name}</span>
              </div>
              
              <Tooltip>
                <Tooltip.Trigger>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(module.status)}`}></div>
                    <span className="text-sm text-muted-foreground">
                      {module.lastActive ? formatTimeAgo(module.lastActive) : 'Inactive'}
                    </span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <div className="max-w-xs">
                    <p className="font-medium">{module.name} details:</p>
                    <p>Status: {module.status}</p>
                    <p>Last active: {module.lastActive ? new Date(module.lastActive).toLocaleString() : 'Never'}</p>
                    {module.details && (
                      <pre className="text-xs mt-2 bg-secondary p-2 rounded overflow-x-auto">
                        {JSON.stringify(module.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </Tooltip.Content>
              </Tooltip>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          {isLoading ? "Loading module status..." : "No module activity detected"}
        </div>
      )}
    </Card>
  );
}
