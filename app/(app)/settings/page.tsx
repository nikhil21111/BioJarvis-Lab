"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Mail,
  Calendar,
  MessageSquare,
  TrendingUp,
  Loader2,
  LogOut,
  Shield,
} from "lucide-react";

interface UsageStats {
  tier: string;
  daily: {
    limit: number;
    used: number;
    remaining: number;
    canQuery: boolean;
  };
  monthly: {
    queries: number;
    tokens: number;
  };
  today: {
    queries: number;
    tokens: number;
  };
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  async function fetchUsage() {
    try {
      const response = await fetch("/api/usage");
      if (!response.ok) throw new Error("Failed to fetch usage");
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    } finally {
      setLoading(false);
    }
  }

  const dailyLimit = usage?.daily.limit ?? 10;
  const usagePercent = usage ? (usage.daily.used / dailyLimit) * 100 : 0;

  return (
    <div className="h-full overflow-auto p-4 bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header - Dark glass container */}
        <div className="p-6 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-white/40 mt-1">
            Manage your account and preferences
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="w-5 h-5 text-[#13ec92]" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#13ec92]" />
              <span className="text-sm font-medium text-white/40">Email</span>
              <span className="text-sm text-white">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#13ec92]" />
              <span className="text-sm font-medium text-white/40">Joined</span>
              <span className="text-sm text-white">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#13ec92]" />
              <span className="text-sm font-medium text-white/40">
                Account type
              </span>
              <Badge
                variant="secondary"
                className="bg-[#13ec92]/20 text-[#13ec92] border-[#13ec92]/30"
              >
                {(usage?.tier || "free").charAt(0).toUpperCase() +
                  (usage?.tier || "free").slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#13ec92]" />
              Usage
            </CardTitle>
            <CardDescription>Your API usage statistics</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#13ec92]" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Daily usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      Daily queries
                    </span>
                    <span className="text-sm text-white/40">
                      {usage?.daily.used || 0} / {dailyLimit}
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <p className="text-xs text-white/30 mt-1">
                    Resets at midnight UTC
                  </p>
                </div>

                <Separator className="bg-white/10" />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-[#13ec92] mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {usage?.monthly.queries || 0}
                    </p>
                    <p className="text-sm text-white/40">Monthly queries</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                    <Calendar className="w-6 h-6 text-[#13ec92] mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">
                      {usage?.today.tokens || 0}
                    </p>
                    <p className="text-sm text-white/40">Tokens today</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Sources Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Connected Data Sources</CardTitle>
            <CardDescription>
              BioJarvis connects to these databases for research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm text-white">PDB</p>
                  <p className="text-xs text-white/30">Protein structures</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm text-white">ChEMBL</p>
                  <p className="text-xs text-white/30">Drug data</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm text-white">UniProt</p>
                  <p className="text-xs text-white/30">Protein info</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p className="font-medium text-sm text-white">PubMed</p>
                  <p className="text-xs text-white/30">Research papers</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={signOut}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <SettingsContent />
    </AppLayout>
  );
}
