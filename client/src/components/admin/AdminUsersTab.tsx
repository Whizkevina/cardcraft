import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Search, Sparkles, Crown, Shield, ChevronRight, Ban, SlidersHorizontal, X, ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AdminPanel, AdminSectionHeader, UserAvatar } from "./AdminShell";
import type { AdminUser } from "./types";
import { isInactiveUser } from "./types";

const PAGE_SIZE = 10;

interface AdminUsersTabProps {
  users: AdminUser[];
  usersLoading: boolean;
  currentUserId: number;
  onSelect: (user: AdminUser) => void;
  onTierChange: (id: number, tier: "free" | "pro") => void;
  onRoleChange: (id: number, role: "user" | "admin") => void;
}

function UserRow({
  user,
  currentUserId,
  onSelect,
  onTierChange,
  onRoleChange,
}: {
  user: AdminUser;
  currentUserId: number;
  onSelect: (user: AdminUser) => void;
  onTierChange: (id: number, tier: "free" | "pro") => void;
  onRoleChange: (id: number, role: "user" | "admin") => void;
}) {
  const isPro = user.tier === "pro";
  const isAdmin = user.role === "admin";
  const isSuspended = user.status === "suspended";

  return (
    <div
      className="group flex items-center gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-secondary/30 transition-colors cursor-pointer border-b border-border/60 last:border-b-0"
      data-testid={`row-user-${user.id}`}
      onClick={() => onSelect(user)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(user); } }}
      role="button"
      tabIndex={0}
    >
      <UserAvatar name={user.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{user.name}</span>
          {user.id === currentUserId && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">You</span>
          )}
          {isPro && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
              <Crown size={9} /> Pro
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">
              <Shield size={9} /> Admin
            </span>
          )}
          {isSuspended && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive">
              <Ban size={9} /> Suspended
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
          <span>{user.projectCount} project{user.projectCount !== 1 ? "s" : ""}</span>
          {user.createdAt && <span>Joined {format(new Date(user.createdAt), "dd MMM yyyy")}</span>}
          {!isPro && <span>{user.downloadsToday || 0}/3 downloads today</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTierChange(user.id, isPro ? "free" : "pro"); }}
          className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isPro
              ? "bg-primary/10 text-primary border-primary/25 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              : "bg-secondary/80 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/25"
          }`}
          data-testid={`button-tier-${user.id}`}
        >
          <Sparkles size={10} /> {isPro ? "Pro" : "Free"}
        </button>
        {user.id !== currentUserId && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRoleChange(user.id, isAdmin ? "user" : "admin"); }}
            title={isAdmin ? "Remove admin role" : "Make admin"}
            className={`hidden sm:inline-flex p-2 rounded-lg hover:bg-secondary transition-colors ${
              isAdmin ? "text-gold" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-role-${user.id}`}
          >
            <Shield size={14} />
          </button>
        )}
        <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </div>
    </div>
  );
}

export function AdminUsersTab({
  users,
  usersLoading,
  currentUserId,
  onSelect,
  onTierChange,
  onRoleChange,
}: AdminUsersTabProps) {
  const [userSearch, setUserSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [atCapOnly, setAtCapOnly] = useState(false);
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [userSearch, tierFilter, roleFilter, sortBy, atCapOnly, inactiveOnly, joinedFrom, joinedTo]);

  const activeFilterCount = [
    tierFilter !== "all",
    roleFilter !== "all",
    sortBy !== "newest",
    atCapOnly,
    inactiveOnly,
    joinedFrom,
    joinedTo,
  ].filter(Boolean).length;

  const filteredUsers = users
    .filter(u => {
      if (userSearch) {
        const q = userSearch.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (tierFilter === "pro" && u.tier !== "pro") return false;
      if (tierFilter === "free" && u.tier !== "free") return false;
      if (roleFilter === "admin" && u.role !== "admin") return false;
      if (roleFilter === "user" && u.role !== "user") return false;
      if (atCapOnly && (u.tier === "pro" || (u.downloadsToday || 0) < 3)) return false;
      if (inactiveOnly && !isInactiveUser(u)) return false;
      if (joinedFrom && u.createdAt && new Date(u.createdAt) < new Date(joinedFrom)) return false;
      if (joinedTo && u.createdAt) {
        const end = new Date(joinedTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(u.createdAt) > end) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "projects") return b.projectCount - a.projectCount;
      if (sortBy === "downloads") return (b.downloadsToday || 0) - (a.downloadsToday || 0);
      if (sortBy === "oldest") {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      }
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const clearFilters = () => {
    setTierFilter("all");
    setRoleFilter("all");
    setSortBy("newest");
    setAtCapOnly(false);
    setInactiveOnly(false);
    setJoinedFrom("");
    setJoinedTo("");
  };

  return (
    <div className="space-y-4">
      <AdminPanel>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search users by name or email…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="pl-10 h-11 text-sm bg-secondary/20 border-border/70"
            data-testid="input-user-search"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-10 text-sm bg-secondary/20" data-testid="select-tier-filter">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="pro">Pro only</SelectItem>
              <SelectItem value="free">Free only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 text-sm bg-secondary/20" data-testid="select-role-filter">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-10 text-sm bg-secondary/20 col-span-2 lg:col-span-1" data-testid="select-user-sort">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="projects">Most projects</SelectItem>
              <SelectItem value="downloads">Most downloads</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto h-10 justify-between sm:justify-start gap-2 text-sm bg-secondary/20 border-border/70"
            >
              <SlidersHorizontal size={14} />
              More filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[1.25rem]">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="joined-from" className="text-xs text-muted-foreground">Joined from</Label>
                <Input
                  id="joined-from"
                  type="date"
                  value={joinedFrom}
                  onChange={e => setJoinedFrom(e.target.value)}
                  className="h-10 text-sm bg-secondary/20"
                  data-testid="input-joined-from"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="joined-to" className="text-xs text-muted-foreground">Joined to</Label>
                <Input
                  id="joined-to"
                  type="date"
                  value={joinedTo}
                  onChange={e => setJoinedTo(e.target.value)}
                  className="h-10 text-sm bg-secondary/20"
                  data-testid="input-joined-to"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={atCapOnly ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setAtCapOnly(v => !v)}
                data-testid="button-at-cap-filter"
              >
                At download cap
              </Button>
              <Button
                type="button"
                variant={inactiveOnly ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setInactiveOnly(v => !v)}
                data-testid="button-inactive-filter"
              >
                Inactive 30+ days
              </Button>
              {activeFilterCount > 0 && (
                <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5" onClick={clearFilters}>
                  <X size={14} /> Clear all
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </AdminPanel>

      <AdminPanel padding="none">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/60">
          <AdminSectionHeader
            title="All users"
            description={`Showing ${pagedUsers.length ? page * PAGE_SIZE + 1 : 0}–${Math.min((page + 1) * PAGE_SIZE, filteredUsers.length)} of ${filteredUsers.length} (${users.length} total) · Tap a row for full profile`}
          />
        </div>
        {usersLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No users match your filters.
          </div>
        ) : (
          <div>
            {pagedUsers.map(u => (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={currentUserId}
                onSelect={onSelect}
                onTierChange={onTierChange}
                onRoleChange={onRoleChange}
              />
            ))}
          </div>
        )}

        {filteredUsers.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-users-prev">
                <ChevronLeft size={14} />
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-users-next">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
