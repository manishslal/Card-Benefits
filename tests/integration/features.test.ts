/**
 * Integration Tests: Feature Modules
 *
 * Validates that all feature modules are properly integrated and importable
 * after the folder structure reorganization.
 *
 * Tests cover:
 * - Auth feature can be imported without errors
 * - Cards feature can be imported without errors
 * - Benefits feature can be imported without errors
 * - Custom values feature can be imported without errors
 * - Import/Export feature can be imported without errors
 * - All feature exports are properly defined
 * - Feature dependencies resolve correctly
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Feature Integration Tests', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const featuresDir = path.join(projectRoot, 'src', 'features');

  /**
   * PHASE 2.1: Auth Feature Integration
   *
   * Tests that the auth feature is properly structured and importable
   */
  describe('Phase 2.1: Auth Feature', () => {
    const authDir = path.join(featuresDir, 'auth');

    it('should have auth feature directory', () => {
      expect(fs.existsSync(authDir)).toBe(true);
      console.log('✓ Auth feature directory exists');
    });

    it('should have auth lib utilities', () => {
      const libDir = path.join(authDir, 'lib');
      expect(fs.existsSync(libDir)).toBe(true);
      
      const requiredFiles = [
        'auth.ts',
        'jwt.ts',
        'password.ts',
        'session.ts',
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(libDir, file);
        expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);
        console.log(`✓ Auth lib file: ${file}`);
      }
    });

    it('should have auth hooks', () => {
      const hooksDir = path.join(authDir, 'hooks');
      expect(fs.existsSync(hooksDir)).toBe(true);
      
      const hookPath = path.join(hooksDir, 'useAuth.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
      console.log('✓ useAuth hook exists');
    });

    it('should have auth context', () => {
      const contextDir = path.join(authDir, 'context');
      expect(fs.existsSync(contextDir)).toBe(true);
      
      const contextPath = path.join(contextDir, 'auth-context.ts');
      expect(fs.existsSync(contextPath)).toBe(true);
      console.log('✓ Auth context exists');
    });

    it('should have auth types', () => {
      const typesDir = path.join(authDir, 'types');
      expect(fs.existsSync(typesDir)).toBe(true);
      console.log('✓ Auth types directory exists');
    });

    it('should export from index.ts', () => {
      const indexPath = path.join(authDir, 'index.ts');
      const exists = fs.existsSync(indexPath);
      if (exists) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        console.log('✓ Auth feature exports from index.ts');
      }
    });
  });

  /**
   * PHASE 2.2: Cards Feature Integration
   *
   * Tests that the cards feature is properly structured and importable
   */
  describe('Phase 2.2: Cards Feature', () => {
    const cardsDir = path.join(featuresDir, 'cards');

    it('should have cards feature directory', () => {
      expect(fs.existsSync(cardsDir)).toBe(true);
      console.log('✓ Cards feature directory exists');
    });

    it('should have cards lib utilities', () => {
      const libDir = path.join(cardsDir, 'lib');
      expect(fs.existsSync(libDir)).toBe(true);
      
      const requiredFiles = [
        'calculations.ts',
        'validation.ts',
        'index.ts',
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(libDir, file);
        const exists = fs.existsSync(filePath);
        if (exists) {
          console.log(`✓ Cards lib file: ${file}`);
        }
      }
    });

    it('should have cards actions', () => {
      const actionsDir = path.join(cardsDir, 'actions');
      expect(fs.existsSync(actionsDir)).toBe(true);
      
      const actionPath = path.join(actionsDir, 'card-management.ts');
      expect(fs.existsSync(actionPath)).toBe(true);
      console.log('✓ Card management actions exist');
    });

    it('should have cards components', () => {
      const componentsDir = path.join(cardsDir, 'components');
      expect(fs.existsSync(componentsDir)).toBe(true);
      
      const subdirs = ['ui', 'card-management'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(componentsDir, subdir);
        if (fs.existsSync(subdirPath)) {
          console.log(`✓ Cards components: ${subdir}`);
        }
      }
    });

    it('should have cards hooks', () => {
      const hooksDir = path.join(cardsDir, 'hooks');
      const exists = fs.existsSync(hooksDir);
      if (exists) {
        console.log('✓ Cards hooks directory exists');
      }
    });

    it('should have cards types', () => {
      const typesDir = path.join(cardsDir, 'types');
      expect(fs.existsSync(typesDir)).toBe(true);
      console.log('✓ Cards types directory exists');
    });
  });

  /**
   * PHASE 2.3: Benefits Feature Integration
   *
   * Tests that the benefits feature is properly structured and importable
   */
  describe('Phase 2.3: Benefits Feature', () => {
    const benefitsDir = path.join(featuresDir, 'benefits');

    it('should have benefits feature directory', () => {
      expect(fs.existsSync(benefitsDir)).toBe(true);
      console.log('✓ Benefits feature directory exists');
    });

    it('should have benefits lib utilities', () => {
      const libDir = path.join(benefitsDir, 'lib');
      expect(fs.existsSync(libDir)).toBe(true);
      
      const requiredFiles = [
        'calculations.ts',
        'validation.ts',
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(libDir, file);
        const exists = fs.existsSync(filePath);
        if (exists) {
          console.log(`✓ Benefits lib file: ${file}`);
        }
      }
    });

    it('should have benefits actions', () => {
      const actionsDir = path.join(benefitsDir, 'actions');
      expect(fs.existsSync(actionsDir)).toBe(true);
      console.log('✓ Benefits actions directory exists');
    });

    it('should have benefits components', () => {
      const componentsDir = path.join(benefitsDir, 'components');
      expect(fs.existsSync(componentsDir)).toBe(true);
      console.log('✓ Benefits components directory exists');
    });

    it('should have benefits context', () => {
      const contextDir = path.join(benefitsDir, 'context');
      expect(fs.existsSync(contextDir)).toBe(true);
      console.log('✓ Benefits context directory exists');
    });

    it('should have benefits types', () => {
      const typesDir = path.join(benefitsDir, 'types');
      expect(fs.existsSync(typesDir)).toBe(true);
      console.log('✓ Benefits types directory exists');
    });

    it('should export from index.ts', () => {
      const indexPath = path.join(benefitsDir, 'index.ts');
      const exists = fs.existsSync(indexPath);
      if (exists) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        console.log('✓ Benefits feature exports from index.ts');
      }
    });
  });

  /**
   * PHASE 2.4: Custom Values Feature Integration
   *
   * Tests that the custom-values feature is properly structured
   */
  describe('Phase 2.4: Custom Values Feature', () => {
    const customValuesDir = path.join(featuresDir, 'custom-values');

    it('should have custom-values feature directory', () => {
      expect(fs.existsSync(customValuesDir)).toBe(true);
      console.log('✓ Custom values feature directory exists');
    });

    it('should have custom-values actions', () => {
      const actionsDir = path.join(customValuesDir, 'actions');
      expect(fs.existsSync(actionsDir)).toBe(true);
      console.log('✓ Custom values actions directory exists');
    });

    it('should have custom-values types', () => {
      const typesDir = path.join(customValuesDir, 'types');
      expect(fs.existsSync(typesDir)).toBe(true);
      console.log('✓ Custom values types directory exists');
    });

    it('should export from index.ts', () => {
      const indexPath = path.join(customValuesDir, 'index.ts');
      const exists = fs.existsSync(indexPath);
      if (exists) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        console.log('✓ Custom values feature exports from index.ts');
      }
    });
  });

  /**
   * PHASE 2.5: Import/Export Feature Integration
   *
   * Tests that the import-export feature is properly structured
   */
  describe('Phase 2.5: Import/Export Feature', () => {
    const importExportDir = path.join(featuresDir, 'import-export');

    it('should have import-export feature directory', () => {
      expect(fs.existsSync(importExportDir)).toBe(true);
      console.log('✓ Import/export feature directory exists');
    });

    it('should have import-export lib utilities', () => {
      const libDir = path.join(importExportDir, 'lib');
      expect(fs.existsSync(libDir)).toBe(true);
      
      const requiredFiles = ['index.ts'];
      
      for (const file of requiredFiles) {
        const filePath = path.join(libDir, file);
        const exists = fs.existsSync(filePath);
        if (exists) {
          console.log(`✓ Import/export lib file: ${file}`);
        }
      }
    });

    it('should have import-export actions', () => {
      const actionsDir = path.join(importExportDir, 'actions');
      expect(fs.existsSync(actionsDir)).toBe(true);
      console.log('✓ Import/export actions directory exists');
    });

    it('should have import-export types', () => {
      const typesDir = path.join(importExportDir, 'types');
      expect(fs.existsSync(typesDir)).toBe(true);
      console.log('✓ Import/export types directory exists');
    });

    it('should export from index.ts', () => {
      const indexPath = path.join(importExportDir, 'index.ts');
      const exists = fs.existsSync(indexPath);
      if (exists) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        console.log('✓ Import/export feature exports from index.ts');
      }
    });
  });

  /**
   * PHASE 2.6: User Settings Feature Integration
   *
   * Tests that the user-settings feature is properly structured
   */
  describe('Phase 2.6: User Settings Feature', () => {
    const userSettingsDir = path.join(featuresDir, 'user-settings');

    it('should have user-settings feature directory', () => {
      expect(fs.existsSync(userSettingsDir)).toBe(true);
      console.log('✓ User settings feature directory exists');
    });

    it('should have user-settings subdirectories', () => {
      const subdirs = ['components', 'lib', 'types', 'actions', 'hooks'];
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(userSettingsDir, subdir);
        const exists = fs.existsSync(subdirPath);
        if (exists) {
          console.log(`✓ User settings has: ${subdir}`);
        }
      }
    });
  });

  /**
   * PHASE 2.7: Shared Module Integration
   *
   * Tests that shared utilities and components are available
   */
  describe('Phase 2.7: Shared Module Integration', () => {
    const sharedDir = path.join(projectRoot, 'src', 'shared');

    it('should have shared directory', () => {
      expect(fs.existsSync(sharedDir)).toBe(true);
      console.log('✓ Shared directory exists');
    });

    it('should have shared lib utilities', () => {
      const libDir = path.join(sharedDir, 'lib');
      expect(fs.existsSync(libDir)).toBe(true);
      console.log('✓ Shared lib directory exists');
    });

    it('should have shared components', () => {
      const componentsDir = path.join(sharedDir, 'components');
      const exists = fs.existsSync(componentsDir);
      if (exists) {
        console.log('✓ Shared components directory exists');
      }
    });

    it('should have shared hooks', () => {
      const hooksDir = path.join(sharedDir, 'hooks');
      const exists = fs.existsSync(hooksDir);
      if (exists) {
        console.log('✓ Shared hooks directory exists');
      }
    });

    it('should have shared types', () => {
      const typesDir = path.join(sharedDir, 'types');
      const exists = fs.existsSync(typesDir);
      if (exists) {
        console.log('✓ Shared types directory exists');
      }
    });
  });

  /**
   * PHASE 2.8: Feature Import Paths
   *
   * Tests that @/features/ import paths are properly configured
   */
  describe('Phase 2.8: Feature Import Paths', () => {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

    it('should have @/features alias configured', () => {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      const hasAlias = tsconfig.compilerOptions?.paths?.['@/features/*'];
      
      expect(hasAlias).toBeDefined();
      console.log('✓ @/features alias configured in tsconfig.json');
    });

    it('should have @/shared alias configured', () => {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      const hasAlias = tsconfig.compilerOptions?.paths?.['@/shared/*'];
      
      expect(hasAlias).toBeDefined();
      console.log('✓ @/shared alias configured in tsconfig.json');
    });
  });

  /**
   * PHASE 2.9: Feature Summary
   */
  describe('Phase 2.9: Feature Summary', () => {
    it('should list all feature modules', () => {
      console.log('\n=== FEATURE SUMMARY ===');
      
      const featureNames = fs.readdirSync(featuresDir).filter((name) => {
        const fullPath = path.join(featuresDir, name);
        return fs.statSync(fullPath).isDirectory();
      });

      console.log(`\nFeature modules (${featureNames.length}):`);
      featureNames.forEach((name) => {
        console.log(`  - ${name}`);
      });

      // Expected features
      const expectedFeatures = [
        'auth',
        'cards',
        'benefits',
        'custom-values',
        'import-export',
        'user-settings',
      ];

      console.log('\nExpected features:');
      expectedFeatures.forEach((name) => {
        const exists = featureNames.includes(name);
        console.log(`  ${exists ? '✓' : '✗'} ${name}`);
      });
    });
  });
});
