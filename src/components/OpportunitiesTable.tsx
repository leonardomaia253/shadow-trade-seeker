
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  tx_hash: string;
  timestamp: string;
  status: string;
  profit: number;
  action: string;
  gas?: number;
}

interface OpportunitiesTableProps {
  transactions: Transaction[];
}

const OpportunitiesTable = ({ transactions }: OpportunitiesTableProps) => {
  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <Activity className="mr-2" /> Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-crypto-border hover:bg-transparent">
              <TableHead className="text-muted-foreground w-1/6">Time</TableHead>
              <TableHead className="text-muted-foreground w-1/5">Transaction</TableHead>
              <TableHead className="text-muted-foreground w-1/6">Status</TableHead>
              <TableHead className="text-muted-foreground w-1/6">Action</TableHead>
              <TableHead className="text-muted-foreground w-1/6">Profit</TableHead>
              <TableHead className="text-muted-foreground w-1/6">Gas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow className="border-crypto-border hover:bg-transparent">
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No transactions recorded yet
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id} className="border-crypto-border hover:bg-crypto-darker">
                  <TableCell className="text-xs">
                    {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <a 
                      href={`https://arbiscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-blue hover:text-neon-blue/80 text-xs"
                    >
                      {`${tx.tx_hash.slice(0, 6)}...${tx.tx_hash.slice(-4)}`}
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs ${
                      tx.status === 'success' 
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {tx.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{tx.action}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {tx.profit > 0 ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-neon-green mr-1" />
                          <span className="text-neon-green text-xs">{tx.profit.toFixed(5)} ETH</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-400 mr-1" />
                          <span className="text-red-400 text-xs">{Math.abs(tx.profit || 0).toFixed(5)} ETH</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {tx.gas ? `${tx.gas.toFixed(5)} ETH` : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default OpportunitiesTable;
