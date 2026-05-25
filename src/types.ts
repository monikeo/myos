export type ItemType = 'task' | 'note' | 'workspace' | 'event' | 'transaction' | 'doc' | 'link' | 'notification' | 'setting' | 'file' | 'tool' | 'project' | 'organization' | 'user' | 'role_assignment';

export interface BaseItem {
  id: string;
  type: ItemType;
  created_at?: string;
  updated_at?: string;
}

export interface Task extends BaseItem {
  type: 'task';
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'review' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  tags?: string[];
  category?: string;
  workspace_id?: string;
  project_id?: string;
  assignee_id?: string;
}

export interface Project extends BaseItem {
  type: 'project';
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date?: string;
  end_date?: string;
  workspace_id?: string;
  color?: string;
  category?: string;
  owner_id?: string;
  user_id?: string;
  budget?: number;
}

export interface Note extends BaseItem {
  type: 'note';
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
  workspace_id?: string;
}

export interface Workspace extends BaseItem {
  type: 'workspace';
  name: string;
  description?: string;
  purpose?: string;
  company?: string;
  color?: string;
  icon?: string;
  logo?: string;
  organization_id?: string;
  user_id?: string;
  owner_id?: string;
}

export interface FinancialTransaction extends BaseItem {
  type: 'transaction';
  amount: number;
  category: string;
  description: string;
  transaction_type: 'income' | 'expense';
  date: string;
  workspace_id?: string;
  project_id?: string;
}

export interface CalendarEvent extends BaseItem {
  type: 'event';
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  category?: string;
  workspace_id?: string;
  color?: string;
  all_day?: boolean;
}

export interface QuickLink extends BaseItem {
  type: 'link';
  title: string;
  url: string;
  category: string;
  icon?: string;
  description?: string;
  favicon?: string;
  workspace_id?: string;
}

export interface StorageFile extends BaseItem {
  type: 'file';
  name: string;
  drive_file_id: string;
  drive_url: string;
  drive_download_url: string;
  mime_type: string;
  size_bytes: number;
  item_id?: string;
}

export interface ToolIntegration extends BaseItem {
  type: 'tool';
  name: string;
  category: string;
  description: string;
  icon: string;
  host_url: string;
  github_url?: string;
  status: 'Active' | 'Beta' | 'Maintenance';
  is_favorite: boolean;
  clicks: number;
  launch_mode: 'iframe' | 'proxy' | 'tab';
  organization_id?: string;
  is_default?: boolean;
  user_id?: string;
}

export interface MyOSNotification extends BaseItem {
  type: 'notification';
  title: string;
  message: string;
  category: 'system' | 'task' | 'finance' | 'workspace' | 'file' | 'security';
  read: boolean;
  link_to?: string;
}

export interface Organization extends BaseItem {
  type: 'organization';
  name: string;
  description?: string;
  owner_id?: string;
  user_id?: string;
  logo_url?: string;
}

export interface User extends BaseItem {
  type: 'user';
  username: string;
  password_hash: string;
  display_name: string;
  role_title?: string;
  avatar_url?: string;
}

export interface RoleAssignment extends BaseItem {
  type: 'role_assignment';
  user_id?: string;
  scope_type: 'organization' | 'workspace' | 'project';
  scope_id: string;
  role: string;
  status?: 'active' | 'pending';
}

export type AnyItem = Task | Note | Workspace | FinancialTransaction | CalendarEvent | QuickLink | StorageFile | ToolIntegration | MyOSNotification | Organization | User | RoleAssignment;
