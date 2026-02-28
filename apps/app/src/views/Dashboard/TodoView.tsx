import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  ClipboardList,
  CheckCircle,
  Circle,
  Clock,
  Home,
  Shield,
  Activity,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in-progress' | 'done';
type Project = 'Privacy' | 'Security' | 'Profile' | 'General';

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  project: Project;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
}

type StatusFilter = 'all' | TaskStatus;
type ProjectFilter = 'all' | Project;

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const TASKS: Task[] = [
  {
    id: '1',
    title: 'Submit opt-out to BeenVerified',
    description: 'Your info was found on BeenVerified. Submit removal request.',
    status: 'todo',
    project: 'Privacy',
    dueDate: 'Mar 1',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Update password — Dropbox breach',
    description: 'Credentials were found in the 2024 Dropbox data leak.',
    status: 'in-progress',
    project: 'Security',
    dueDate: 'Feb 28',
    priority: 'high',
  },
  {
    id: '3',
    title: 'Enable 2FA on Google account',
    description: 'Your Google account is not protected with two-factor auth.',
    status: 'todo',
    project: 'Security',
    dueDate: 'Mar 5',
    priority: 'medium',
  },
  {
    id: '4',
    title: 'Review Whitepages exposure',
    description: 'Home address and phone number visible on Whitepages.',
    status: 'in-progress',
    project: 'Privacy',
    dueDate: 'Mar 3',
    priority: 'high',
  },
  {
    id: '5',
    title: 'Confirm home address on profile',
    description: 'Verify your current address is accurate in your profile.',
    status: 'todo',
    project: 'Profile',
    dueDate: null,
    priority: 'low',
  },
  {
    id: '6',
    title: 'Spokeo opt-out confirmed',
    description: 'Record successfully removed from Spokeo.',
    status: 'done',
    project: 'Privacy',
    dueDate: null,
    priority: 'high',
  },
  {
    id: '7',
    title: 'LinkedIn privacy settings reviewed',
    description: 'Profile visibility set to connections only.',
    status: 'done',
    project: 'Security',
    dueDate: null,
    priority: 'medium',
  },
  {
    id: '8',
    title: 'Add secondary email to monitoring',
    description: 'Add your work email to track additional breach exposure.',
    status: 'in-progress',
    project: 'Profile',
    dueDate: 'Mar 10',
    priority: 'medium',
  },
  {
    id: '9',
    title: 'Opt-out from Acxiom',
    description: 'Your full profile was found on Acxiom — opt-out required.',
    status: 'todo',
    project: 'Privacy',
    dueDate: 'Mar 8',
    priority: 'high',
  },
  {
    id: '10',
    title: 'Review exposed data types from 2023 breach',
    description: 'Old Equifax breach contained SSN and financial data.',
    status: 'done',
    project: 'Security',
    dueDate: null,
    priority: 'high',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ElementType;
}> = {
  'todo':        { label: 'To Do',       color: 'text-[#B8C4CC]', bg: 'bg-[#B8C4CC]/10', border: 'border-[#B8C4CC]/30', Icon: Circle      },
  'in-progress': { label: 'In Progress', color: 'text-[#00BFFF]', bg: 'bg-[#00BFFF]/10', border: 'border-[#00BFFF]/30', Icon: Clock       },
  'done':        { label: 'Done',        color: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/10', border: 'border-[#00D4AA]/30', Icon: CheckCircle },
};

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high:   'bg-[#FF8A00]',
  medium: 'bg-[#FFB81C]',
  low:    'bg-[#7A92A8]',
};

const PROJECT_CONFIG: Record<Project, { color: string; bg: string }> = {
  Privacy:  { color: 'text-[#00BFFF]', bg: 'bg-[#00BFFF]/10' },
  Security: { color: 'text-[#FF8A00]', bg: 'bg-[#FF8A00]/10' },
  Profile:  { color: 'text-[#B8C4CC]', bg: 'bg-[#B8C4CC]/10' },
  General:  { color: 'text-[#7A92A8]', bg: 'bg-[#7A92A8]/10' },
};

const ALL_PROJECTS: Project[] = ['Privacy', 'Security', 'Profile', 'General'];
const ALL_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Nav
// ─────────────────────────────────────────────────────────────────────────────

function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#022136] border-t border-[#2A4A68] h-16 px-2 flex items-center justify-around z-50">
      {[
        { label: 'Home',     Icon: Home,         path: '/dashboard/home',     active: false },
        { label: 'Exposures', Icon: Shield,       path: '/dashboard/exposures', active: false },
        { label: 'Tasks',    Icon: ClipboardList, path: '/dashboard/tasks',    active: true  },
        { label: 'Activity', Icon: Activity,      path: '/dashboard/activity', active: false },
      ].map(({ label, Icon, path, active }) => (
        <button
          key={label}
          className="flex flex-col items-center gap-1 flex-1 py-2 cursor-pointer"
          onClick={() => navigate(path)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className={`w-5 h-5 ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`} />
          <span className={`text-[10px] font-medium ${active ? 'text-[#00BFFF]' : 'text-[#7A92A8]'}`}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TodoView
// ─────────────────────────────────────────────────────────────────────────────

export function TodoView() {
  const [tasks, setTasks]                 = useState<Task[]>(TASKS);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');

  // ── Tasks scoped to the selected project ─────────────────────────────────
  const projectScoped = useMemo(() =>
    projectFilter === 'all'
      ? tasks
      : tasks.filter(t => t.project === projectFilter),
    [tasks, projectFilter]
  );

  // ── Stat counts — always reflect selected project ─────────────────────────
  const todoCount       = projectScoped.filter(t => t.status === 'todo').length;
  const inProgressCount = projectScoped.filter(t => t.status === 'in-progress').length;
  const doneCount       = projectScoped.filter(t => t.status === 'done').length;

  // ── Final filtered list ────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    projectScoped.filter(t =>
      statusFilter === 'all' || t.status === statusFilter
    ),
    [projectScoped, statusFilter]
  );

  // ── Toggle done ────────────────────────────────────────────────────────────
  function toggleDone(taskId: string) {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: t.status === 'done' ? 'todo' : 'done' }
          : t
      )
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#022136] font-ubuntu">
      <main className="px-4 pb-24 space-y-4">

        {/* ── PAGE TITLE ──────────────────────────────────────────────────── */}
        <div className="pt-6">
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
        </div>

        {/* ── PROJECT CHIPS (Activity page style) ─────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(['all', ...ALL_PROJECTS] as (ProjectFilter)[]).map((p) => {
            const isActive = projectFilter === p;
            const label = p === 'all' ? 'All' : p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProjectFilter(p)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#00BFFF] text-[#022136]'
                    : 'bg-[#2D3847] border border-[#2A4A68] text-[#B8C4CC]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── STATS STRIP — updates with project chip ──────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#7A92A8] uppercase tracking-wide">To Do</span>
            <span className="text-2xl font-bold text-white">{todoCount}</span>
          </div>
          <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#7A92A8] uppercase tracking-wide">In Progress</span>
            <span className="text-2xl font-bold text-[#00BFFF]">{inProgressCount}</span>
          </div>
          <div className="bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#7A92A8] uppercase tracking-wide">Done</span>
            <span className="text-2xl font-bold text-[#00D4AA]">{doneCount}</span>
          </div>
        </div>

        {/* ── STATUS FILTER CHIPS ───────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(['all', ...ALL_STATUSES] as StatusFilter[]).map((s) => {
            const isActive = statusFilter === s;
            const label = s === 'all' ? 'All' : STATUS_CONFIG[s].label;
            const count = s === 'all'
              ? projectScoped.length
              : projectScoped.filter(t => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#00BFFF]/20 border-[#00BFFF] text-[#00BFFF]'
                    : 'bg-transparent border-[#2A4A68] text-[#7A92A8] hover:border-[#4A6A88] hover:text-[#B8C4CC]'
                }`}
              >
                {label}
                <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* ── TASK LIST ─────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center">
            <ClipboardList className="w-8 h-8 text-[#7A92A8]" />
            <p className="text-sm font-bold text-white">No tasks match these filters</p>
            <p className="text-xs text-[#7A92A8]">Try adjusting the project or status filter above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(task => {
              const cfg     = STATUS_CONFIG[task.status];
              const projCfg = PROJECT_CONFIG[task.project];
              const StatusIcon = cfg.Icon;
              return (
                <div
                  key={task.id}
                  className={`bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-4 flex items-start gap-3 transition-opacity duration-200 ${
                    task.status === 'done' ? 'opacity-60' : ''
                  }`}
                >
                  {/* Checkbox toggle */}
                  <button
                    onClick={() => toggleDone(task.id)}
                    className="mt-0.5 flex-shrink-0 cursor-pointer"
                    aria-label={
                      task.status === 'done'
                        ? `Mark "${task.title}" as to do`
                        : `Mark "${task.title}" as done`
                    }
                  >
                    {task.status === 'done'
                      ? <CheckCircle className="w-5 h-5 text-[#00D4AA]" />
                      : <Circle      className="w-5 h-5 text-[#2A4A68] hover:text-[#7A92A8] transition-colors" />
                    }
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${
                      task.status === 'done' ? 'text-[#7A92A8] line-through' : 'text-white'
                    }`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-[#7A92A8] mt-0.5 leading-snug">{task.description}</p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${projCfg.color} ${projCfg.bg}`}>
                        {task.project}
                      </span>
                      {task.dueDate && task.status !== 'done' && (
                        <span className="text-[10px] text-[#7A92A8]">Due {task.dueDate}</span>
                      )}
                      {task.priority === 'high' && task.status !== 'done' && (
                        <span className="flex items-center gap-1 text-[10px] text-[#B8C4CC]">
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${PRIORITY_DOT[task.priority]}`} />
                          High
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label.toUpperCase().replace(' ', '\u00A0')}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
