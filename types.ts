
export type Language = 'de' | 'en';

export enum AdminTab {
  DASHBOARD = 'dashboard',
  USERS = 'users',
  FACILITIES = 'facilities',
  REFRIGERATORS = 'refrigerators',
  MENUS = 'menus',
  FORM_CREATOR = 'form_creator',
  ASSIGNMENTS = 'assignments',
  REPORTS = 'reports',
  FACILITY_ANALYTICS = 'facility_analytics',
  SETTINGS = 'settings',
  BACKUP_SYNC = 'backup_sync',
  AUDIT_LOGS = 'audit_logs',
  REMINDERS = 'reminders'
}

export interface ReminderConfig {
  id: string;
  time: string; // HH:mm
  label: string;
  active: boolean;
  days: number[]; // 1=Mo, 7=So
  targetRoles: ('User' | 'Manager' | 'Admin')[];
}

export type AssignmentFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type AssignmentTargetType = 'user' | 'facility' | 'facilityType';
export type AssignmentResourceType = 'form' | 'menu';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'LOGIN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SYSTEM';
  details: string;
  entity: string;
}

export interface Assignment {
  id: string;
  targetType: AssignmentTargetType;
  targetId: string; // User ID, Facility ID, or FacilityType ID
  resourceType: AssignmentResourceType;
  resourceId: string; // Form ID or Menu ID
  frequency: AssignmentFrequency;
  frequencyDay?: number; // 1-7 for weekly, 1-31 for monthly
  startDate: string;
  endDate: string;
  skipWeekend: boolean;
  skipHolidays: boolean;
}

export interface Reading {
  id: string;
  targetId: string; // Fridge ID or Menu ID
  targetType: 'refrigerator' | 'menu';
  checkpointName: string; // e.g., "Kern", "Luft"
  value: number;
  timestamp: string; // ISO String
  userId: string;
  facilityId: string;
  isLocked: boolean;
  reason?: string; // New: Reason for out-of-range values
}

export interface Alert {
  id: string;
  facilityId: string;
  facilityName: string;
  targetName: string;
  checkpointName: string;
  value: number;
  min: number;
  max: number;
  timestamp: string;
  userId: string;
  userName: string;
  resolved: boolean;
}

export interface FormResponse {
  id: string;
  formId: string;
  facilityId: string;
  userId: string;
  timestamp: string;
  answers: Record<string, string>; // Maps questionId to the chosen answer
  signature?: string; // Base64 data URI of the signature
}

export interface Role {
  id: string;
  name: string;
  permissions: AdminTab[];
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface Checkpoint {
  name: string;
  minTemp: number | string;
  maxTemp: number | string;
}

export interface CookingMethod {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
}

export interface RefrigeratorType {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
}

export interface FacilityType {
  id: string;
  name: string;
}

export interface Manager {
  id: string;
  name: string;
  department: string;
  roleId?: string;
}

export interface FacilityException {
  id: string;
  name: string;
  facilityIds: string[];
  reason: string;
  startDate: string;
  endDate: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  password?: string;
  role: 'Admin' | 'User' | 'Manager' | 'SuperAdmin';
  status: 'Active' | 'Inactive';
  facilityId?: string;
  emailAlerts?: boolean;
  telegramAlerts?: boolean;
  telegramChatId?: string;
  fridgeAlertsEnabled?: boolean;
  haccpAlertsEnabled?: boolean;
  alertFacilityIds?: string[]; // Custom list for Admins
  allFacilitiesAlerts?: boolean; // Global toggle for Admins
}

export interface Facility {
  id: string;
  name: string;
  refrigeratorCount: number;
  typeId?: string;
  cookingMethodId?: string;
  supervisorId?: string; // Linked to a User with role 'Manager' or 'Admin'
}

export interface Refrigerator {
  id: string;
  name: string;
  facilityId: string;
  currentTemp: number;
  status: 'Optimal' | 'Warning' | 'Critical';
  typeName?: string; // Links to RefrigeratorType name
}

export interface Menu {
  id: string;
  name: string;
}

export interface FormOption {
  id: string;
  text: string;
}

export type QuestionType = 'text' | 'choice' | 'yesno';

export interface FormQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: FormOption[];
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  questions: FormQuestion[];
  requiresSignature: boolean;
  createdAt: string;
}

export interface TranslationSet {
  login: string;
  username: string;
  password: string;
  loginButton: string;
  welcome: string;
  logout: string;
  tabs: Record<AdminTab, string> & { user_workspace: string; user_reports: string; user_forms: string };
  languageToggle: string;
  activeLanguage: string;
  settings: {
    holidays: string;
    cookingMethods: string;
    fridgeTypes: string;
    facilityTypes: string;
    supervisors: string;
    managers: string;
    facilityExceptions: string;
    excludedFacilities: string;
    add: string;
    save: string;
    delete: string;
    edit: string;
    name: string;
    startDate: string;
    endDate: string;
    search: string;
    checkpoints: string;
    minTemp: string;
    maxTemp: string;
    placeholder: string;
    phone: string;
    department: string;
    reason: string;
    facility: string;
    roles: string;
    permissions: string;
    email: string;
  };
}
