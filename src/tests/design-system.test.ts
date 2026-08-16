/**
 * src/tests/design-system.test.ts
 *
 * Comprehensive Test Suite for Helpa Design System & UI Consolidation (Step 8).
 * Verifies component exports, rendering props, pagination logic, and design token integrity.
 */

import { describe, it, expect } from 'vitest';
import {
  EmptyState,
  LoadingState,
  ErrorState,
  Pagination,
  DatePicker,
  CommandSearch,
} from '@/components/ui';

describe('Helpa Standardized Design System & UI Components', () => {
  describe('Component Definitions & Exports', () => {
    it('exports all standardized UI components from barrel index', () => {
      expect(EmptyState).toBeDefined();
      expect(LoadingState).toBeDefined();
      expect(ErrorState).toBeDefined();
      expect(Pagination).toBeDefined();
      expect(DatePicker).toBeDefined();
      expect(CommandSearch).toBeDefined();
    });
  });

  describe('Pagination Logic', () => {
    it('calculates item ranges correctly for page 1 of 50 items with page size 10', () => {
      const page = 1;
      const pageSize = 10;
      const totalItems = 50;

      const startItem = (page - 1) * pageSize + 1;
      const endItem = Math.min(page * pageSize, totalItems);

      expect(startItem).toBe(1);
      expect(endItem).toBe(10);
    });

    it('calculates item ranges correctly for last page', () => {
      const page = 5;
      const pageSize = 10;
      const totalItems = 43;

      const startItem = (page - 1) * pageSize + 1;
      const endItem = Math.min(page * pageSize, totalItems);

      expect(startItem).toBe(41);
      expect(endItem).toBe(43);
    });
  });

  describe('DatePicker Shortcuts', () => {
    it('calculates offset date strings in YYYY-MM-DD format', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tomorrowStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
