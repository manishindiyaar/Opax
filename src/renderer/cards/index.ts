/**
 * Card Registry System
 * Maps componentType values (from MCP metadata) to UI card components.
 * Falls back to tool name lookup for backward compatibility.
 */

import { CardRegistry, CardComponent } from './types';
import { CallCard } from './call/CallCard';
import { PatientInfoCard } from './patient/PatientInfoCard';
import { PatientProfileCard } from './patient/PatientProfileCard';
import { PatientListCard } from './patient/PatientListCard';
import { StaffProfileCard } from './staff/StaffProfileCard';
import { StaffListCard } from './staffList/StaffListCard';
import { TaskListCard } from './task/TaskListCard';
import { LabResultCard } from './lab/LabResultCard';
import { LabResultsListCard } from './lab/LabResultsListCard';
import { LabOrderCard } from './lab/LabOrderCard';
import { LabOrderListCard } from './lab/LabOrderListCard';
import { ErrorCard } from './error/ErrorCard';
import { FormCard } from './form';

// Primary registry: keyed by metadata.componentType
const componentTypeRegistry: CardRegistry = {
  // Universal
  'form-card': FormCard,
  'error-card': ErrorCard,

  // PMS
  'patient-info-card': PatientProfileCard,
  'patient-list-card': PatientListCard,
  'note-card': PatientProfileCard,
  'search-results-card': PatientListCard,
  'appointment-card': PatientProfileCard,
  'appointment-list-card': PatientListCard,

  // SAS
  'staff-profile-card': StaffProfileCard,
  'staff-list-card': StaffListCard,
  'call-card': CallCard,
  'task-card': TaskListCard,
  'task-list-card': TaskListCard,

  // LTS
  'lab-order-card': LabOrderCard,
  'lab-order-list-card': LabOrderListCard,
  'lab-result-card': LabResultCard,
  'lab-result-list-card': LabResultsListCard,
};

// Fallback registry: keyed by tool name (backward compat)
const toolNameRegistry: CardRegistry = {
  'call_staff': CallCard,
  'call_staff_by_name': CallCard,
  'get_patient_info': PatientInfoCard,
  'lookup_patient': PatientInfoCard,
  'search_patient': PatientInfoCard,
  'get_patient_profile': PatientProfileCard,
  'create_patient': PatientProfileCard,
  'list_patients': PatientListCard,
  'get_staff_profile': StaffProfileCard,
  'create_staff': StaffProfileCard,
  'update_staff_status': StaffProfileCard,
  'list_staff': StaffListCard,
  'find_available_staff': StaffListCard,
  'find_staff_by_name': StaffListCard,
  'list_tasks': TaskListCard,
  'list_active_calls': TaskListCard,
  'assign_task': TaskListCard,
  'complete_task': TaskListCard,
  'get_task_status': TaskListCard,
  'get_call_result': TaskListCard,
  'create_lab_result': LabResultCard,
  'get_result_details': LabResultCard,
  'get_lab_results': LabResultsListCard,
  'order_lab_test': LabOrderCard,
  'get_order_status': LabOrderCard,
  'update_order_status': LabOrderCard,
  'list_lab_orders': LabOrderListCard,
  'list_pending_orders': LabOrderListCard,
  'error': ErrorCard,
};

// Combined registry for export (componentType takes priority)
export const cardRegistry: CardRegistry = {
  ...toolNameRegistry,
  ...componentTypeRegistry,
};

/**
 * Look up card by componentType first, then fall back to tool name
 */
export function getCardByComponentType(componentType: string): CardComponent | null {
  return componentTypeRegistry[componentType] || null;
}

export function getCardForTool(toolName: string): CardComponent | null {
  return toolNameRegistry[toolName] || null;
}

export function registerCard(key: string, component: CardComponent): void {
  componentTypeRegistry[key] = component;
}

export function hasCard(key: string): boolean {
  return key in componentTypeRegistry || key in toolNameRegistry;
}

// Export card components
export { CallCard } from './call/CallCard';
export { PatientInfoCard } from './patient/PatientInfoCard';
export { PatientProfileCard } from './patient/PatientProfileCard';
export { PatientListCard } from './patient/PatientListCard';
export { StaffProfileCard } from './staff/StaffProfileCard';
export { StaffListCard } from './staffList/StaffListCard';
export { TaskListCard } from './task/TaskListCard';
export { LabResultCard } from './lab/LabResultCard';
export { LabResultsListCard } from './lab/LabResultsListCard';
export { LabOrderCard } from './lab/LabOrderCard';
export { LabOrderListCard } from './lab/LabOrderListCard';
export { ErrorCard } from './error/ErrorCard';
export { FormCard } from './form';
export { CardRenderer } from './CardRenderer';

export type { CardRegistry, CardComponent } from './types';
