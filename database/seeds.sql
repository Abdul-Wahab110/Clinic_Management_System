-- =======================================================
-- CLINIC & HOSPITAL MANAGEMENT SYSTEM - SEED DATA
-- 9 System Roles, Granular Dot-Notation Permissions, Matrix
-- =======================================================

-- 1. SEED 9 ROLES
INSERT INTO roles (id, name, display_name, description, is_system) VALUES
(1, 'super_admin', 'Super Admin', 'Full unrestricted infrastructure and security control', 1),
(2, 'hospital_admin', 'Hospital Admin', 'Operations, department management, staff onboarding and analytics', 1),
(3, 'doctor', 'Doctor / Physician', 'Clinical consultations, prescriptions, patient medical records', 1),
(4, 'receptionist', 'Receptionist', 'Front desk registration, appointment queue, patient check-in', 1),
(5, 'nurse', 'Nurse', 'Triage, vital signs recording, inpatient monitoring', 1),
(6, 'lab_technician', 'Lab Technician', 'Diagnostic tests, pathology processing, laboratory reports', 1),
(7, 'pharmacist', 'Pharmacist', 'Medication inventory, dispensing, prescription fulfillment', 1),
(8, 'accountant', 'Accountant', 'Invoicing, payment processing, revenue auditing, financial ledger', 1),
(9, 'patient', 'Patient', 'Personal appointments, prescriptions, invoices, and health records', 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description);

-- 2. SEED COMPREHENSIVE DOT-NOTATION PERMISSIONS
INSERT INTO permissions (id, code, module, description) VALUES
-- Patients Module
(1, 'patients.view', 'patients', 'View patient directory and health summaries'),
(2, 'patients.create', 'patients', 'Register new patient profiles'),
(3, 'patients.update', 'patients', 'Edit existing patient records'),
(4, 'patients.delete', 'patients', 'Archive or delete patient records'),
-- Appointments Module
(5, 'appointments.view', 'appointments', 'View appointment calendar and slots'),
(6, 'appointments.create', 'appointments', 'Schedule and book new appointments'),
(7, 'appointments.update', 'appointments', 'Reschedule or modify appointments'),
(8, 'appointments.delete', 'appointments', 'Cancel or delete appointments'),
-- Medical Records (EMR)
(9, 'medical_records.view', 'medical_records', 'View clinical notes and diagnostic history'),
(10, 'medical_records.create', 'medical_records', 'Create diagnostic entries and vitals'),
(11, 'medical_records.update', 'medical_records', 'Update clinical diagnoses and observations'),
(12, 'medical_records.delete', 'medical_records', 'Archive clinical medical records'),
-- Billing & Finance
(13, 'billing.view', 'billing', 'View invoices, receipts, and payment status'),
(14, 'billing.create', 'billing', 'Generate invoices and collect payments'),
(15, 'billing.update', 'billing', 'Apply discounts and modify invoices'),
(16, 'billing.delete', 'billing', 'Cancel or refund invoices'),
-- Pharmacy & Dispensary
(17, 'pharmacy.view', 'pharmacy', 'View prescription queue and inventory'),
(18, 'pharmacy.dispense', 'pharmacy', 'Dispense medications and fulfill prescriptions'),
(19, 'pharmacy.manage', 'pharmacy', 'Manage medication stock and suppliers'),
-- Laboratory & Diagnostics
(20, 'lab.view', 'lab', 'View lab test orders and specimen status'),
(21, 'lab.process', 'lab', 'Process lab specimens and upload results'),
(22, 'lab.manage', 'lab', 'Manage lab test catalog and equipment'),
-- Reports & Analytics
(23, 'reports.view', 'reports', 'View operational and financial reports'),
(24, 'reports.export', 'reports', 'Export data and clinical analytics reports'),
-- User & Staff Management
(25, 'users.view', 'users', 'View system user accounts and profiles'),
(26, 'users.create', 'users', 'Create staff and practitioner user accounts'),
(27, 'users.update', 'users', 'Edit user roles, status, and credentials'),
(28, 'users.delete', 'users', 'Deactivate or delete user accounts'),
-- Role & Permission Management
(29, 'roles.view', 'roles', 'View system roles and permission sets'),
(30, 'roles.manage', 'roles', 'Create, edit, and assign role permissions'),
-- System Settings & Audit
(31, 'settings.manage', 'settings', 'Configure system-wide settings and policies'),
(32, 'audit.view', 'audit', 'Inspect security audit logs and event history')
ON DUPLICATE KEY UPDATE description = VALUES(description), module = VALUES(module);

-- 3. SEED ROLE PERMISSION RELATIONSHIPS
DELETE FROM role_permissions;

-- Super Admin: Has all 32 permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Hospital Admin: Administrative & operational management
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 3),
(2, 5), (2, 6), (2, 7),
(2, 9), (2, 13), (2, 14), (2, 15),
(2, 17), (2, 20), (2, 23), (2, 24),
(2, 25), (2, 26), (2, 27), (2, 29), (2, 30), (2, 32);

-- Doctor: Clinical, appointments, medical records, view pharmacy & lab
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 5), (3, 6), (3, 7),
(3, 9), (3, 10), (3, 11),
(3, 17), (3, 20), (3, 23);

-- Receptionist: Patients, appointments booking, intake billing
INSERT INTO role_permissions (role_id, permission_id) VALUES
(4, 1), (4, 2), (4, 3),
(4, 5), (4, 6), (4, 7), (4, 8),
(4, 13), (4, 14);

-- Nurse: Patients, vitals, appointments view
INSERT INTO role_permissions (role_id, permission_id) VALUES
(5, 1), (5, 5), (5, 9), (5, 10), (5, 11);

-- Lab Technician: Lab test processing, view patients
INSERT INTO role_permissions (role_id, permission_id) VALUES
(6, 1), (6, 9), (6, 20), (6, 21);

-- Pharmacist: Pharmacy dispensing & prescriptions view
INSERT INTO role_permissions (role_id, permission_id) VALUES
(7, 1), (7, 9), (7, 17), (7, 18), (7, 19);

-- Accountant: Billing, invoices, reports
INSERT INTO role_permissions (role_id, permission_id) VALUES
(8, 1), (8, 5), (8, 13), (8, 14), (8, 15), (8, 16), (8, 23), (8, 24);

-- Patient: View own appointments, records, invoices
INSERT INTO role_permissions (role_id, permission_id) VALUES
(9, 5), (9, 6), (9, 9), (9, 13);

-- 4. SEED USERS (Default password: Clinic2026!)
INSERT INTO users (id, role_id, full_name, email, password_hash, phone, status, email_verified) VALUES
(1, 1, 'Alexander Wright (Super Admin)', 'superadmin@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0001', 'active', 1),
(2, 2, 'Dr. Sarah Jenkins (Hospital Admin)', 'admin@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0002', 'active', 1),
(3, 3, 'Dr. Marcus Vance (Cardiologist)', 'marcus.vance@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0003', 'active', 1),
(4, 3, 'Dr. Elena Rostova (Neurologist)', 'elena.rostova@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0004', 'active', 1),
(5, 4, 'Olivia Reynolds (Receptionist)', 'reception@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0005', 'active', 1),
(6, 5, 'Nurse Chloe Bennett (Triage Nurse)', 'nurse@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0006', 'active', 1),
(7, 6, 'Daniel Sterling (Lab Technician)', 'lab@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0007', 'active', 1),
(8, 7, 'Hannah Morgan (Chief Pharmacist)', 'pharmacy@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0008', 'active', 1),
(9, 8, 'Robert Lang (Lead Accountant)', 'billing@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 010-0009', 'active', 1),
(10, 9, 'Arthur Pendleton (Patient)', 'patient@auracare.com', '$2a$10$bVuxFz6DlXjVgY4amaBXpO6qOkEprTQrbZGJORqkEvNdNiN/nRhpe', '+1 (555) 742-9912', 'active', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role_id = VALUES(role_id);
