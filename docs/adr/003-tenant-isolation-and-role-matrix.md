# ADR 003: Multi-Tenant Scoping and Role-Based Authorization

## Status

Accepted and Enforced (2026-08)

## Context

Helpa is a multi-tenant healthcare CRM where accounts share infrastructure. No tenant must ever be able to read, mutate, or delete records belonging to another tenant.

## Decision

1. **Mandatory `account_id` Scoping**: Every database operation (contacts, appointments, lab reports, messages, automations) must include an explicit `account_id` WHERE filter.
2. **Role Hierarchy**:
   - `owner`: Full privileges, ownership transfer, billing.
   - `admin`: User invitations, WhatsApp configuration, team management.
   - `agent`: Read and respond to inbox, manage patients and appointments.
   - `viewer`: Read-only access to dashboard and analytics.
3. **Defense in Depth**: Handlers verify `hasMinRole(callerRole, requiredRole)` at both API and UI boundaries.
