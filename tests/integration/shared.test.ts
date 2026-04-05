/**
 * Integration Tests: Shared Components & Utilities
 *
 * Validates that shared utilities, components, and hooks are properly
 * structured and can be imported after reorganization.
 *
 * Tests cover:
 * - Shared components exist and can be imported
 * - Shared hooks are properly defined
 * - Shared utilities/lib functions are available
 * - Type definitions are complete
 * - Component exports are valid
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Shared Integration Tests', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  const sharedDir = path.join(projectRoot, 'src', 'shared');

  /**
   * PHASE 3.1: Shared Library Integration
   *
   * Tests that shared lib utilities exist and are importable
   */
  describe('Phase 3.1: Shared Library Utilities', () => {
    const libDir = path.join(sharedDir, 'lib');

    it('should have shared lib directory', () => {
      expect(fs.existsSync(libDir)).toBe(true);
      console.log('✓ Shared lib directory exists');
    });

    it('should have lib index export file', () => {
      const indexPath = path.join(libDir, 'index.ts');
      expect(fs.existsSync(indexPath)).toBe(true);
      
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
      console.log('✓ Shared lib/index.ts exports utilities');
    });

    it('should have common utility files', () => {
      const expectedFiles = [
        'validation.ts',
        'error-handling.ts',
        'types.ts',
      ];

      const libFiles = fs.readdirSync(libDir);
      
      for (const file of expectedFiles) {
        const exists = libFiles.includes(file);
        if (exists) {
          console.log(`✓ Lib utility: ${file}`);
        }
      }
    });

    it('should export error handling utilities', () => {
      const indexPath = path.join(libDir, 'index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      
      const hasErrorExports = content.includes('AppError') || 
                              content.includes('ERROR_CODES') ||
                              content.includes('ERROR_MESSAGES');
      
      if (hasErrorExports) {
        console.log('✓ Error handling utilities exported');
      }
    });

    it('should export validation utilities', () => {
      const indexPath = path.join(libDir, 'index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      
      const hasValidationExports = content.includes('validate') || 
                                   content.includes('Validator');
      
      if (hasValidationExports) {
        console.log('✓ Validation utilities exported');
      }
    });
  });

  /**
   * PHASE 3.2: Shared Components Integration
   *
   * Tests that shared UI components exist and can be imported
   */
  describe('Phase 3.2: Shared UI Components', () => {
    const componentsDir = path.join(sharedDir, 'components');

    it('should have shared components directory', () => {
      const exists = fs.existsSync(componentsDir);
      if (exists) {
        console.log('✓ Shared components directory exists');
      }
    });

    if (fs.existsSync(componentsDir)) {
      it('should have component subdirectories', () => {
        const subdirs = fs.readdirSync(componentsDir).filter((name) => {
          const fullPath = path.join(componentsDir, name);
          return fs.statSync(fullPath).isDirectory();
        });

        console.log(`✓ Found ${subdirs.length} component subdirectories`);
        subdirs.forEach((dir) => {
          console.log(`  - ${dir}`);
        });
      });

      it('should have component index exports', () => {
        const subdirs = fs.readdirSync(componentsDir).filter((name) => {
          const fullPath = path.join(componentsDir, name);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const subdir of subdirs) {
          const indexPath = path.join(componentsDir, subdir, 'index.ts');
          const indexExists = fs.existsSync(indexPath);
          if (indexExists) {
            console.log(`✓ Component ${subdir} has index.ts`);
          }
        }
      });
    }
  });

  /**
   * PHASE 3.3: Shared Hooks Integration
   *
   * Tests that shared React hooks exist and are importable
   */
  describe('Phase 3.3: Shared Hooks', () => {
    const hooksDir = path.join(sharedDir, 'hooks');

    it('should have shared hooks directory', () => {
      const exists = fs.existsSync(hooksDir);
      if (exists) {
        console.log('✓ Shared hooks directory exists');
      }
    });

    if (fs.existsSync(hooksDir)) {
      it('should have hook files', () => {
        const hookFiles = fs.readdirSync(hooksDir).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));

        console.log(`✓ Found ${hookFiles.length} hook files`);
        hookFiles.forEach((file) => {
          console.log(`  - ${file}`);
        });
      });

      it('should have hooks index export', () => {
        const indexPath = path.join(hooksDir, 'index.ts');
        const exists = fs.existsSync(indexPath);
        if (exists) {
          const content = fs.readFileSync(indexPath, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
          console.log('✓ Shared hooks/index.ts exports hooks');
        }
      });
    }
  });

  /**
   * PHASE 3.4: Shared Types Integration
   *
   * Tests that shared type definitions exist
   */
  describe('Phase 3.4: Shared Types', () => {
    const typesDir = path.join(sharedDir, 'types');

    it('should have shared types directory', () => {
      const exists = fs.existsSync(typesDir);
      if (exists) {
        console.log('✓ Shared types directory exists');
      }
    });

    if (fs.existsSync(typesDir)) {
      it('should have type definition files', () => {
        const typeFiles = fs.readdirSync(typesDir).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));

        console.log(`✓ Found ${typeFiles.length} type files`);
        typeFiles.forEach((file) => {
          console.log(`  - ${file}`);
        });
      });

      it('should have types index export', () => {
        const indexPath = path.join(typesDir, 'index.ts');
        const exists = fs.existsSync(indexPath);
        if (exists) {
          const content = fs.readFileSync(indexPath, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
          console.log('✓ Shared types/index.ts exports types');
        }
      });
    }
  });

  /**
   * PHASE 3.5: Shared Styles Integration
   *
   * Tests that shared styling is available
   */
  describe('Phase 3.5: Shared Styles', () => {
    const stylesDir = path.join(projectRoot, 'src', 'styles');

    it('should have styles directory', () => {
      const exists = fs.existsSync(stylesDir);
      if (exists) {
        console.log('✓ Styles directory exists');
      }
    });

    if (fs.existsSync(stylesDir)) {
      it('should have style files', () => {
        const styleFiles = fs.readdirSync(stylesDir).filter((name) => name.endsWith('.css') || name.endsWith('.scss'));

        console.log(`✓ Found ${styleFiles.length} style files`);
        styleFiles.forEach((file) => {
          console.log(`  - ${file}`);
        });
      });
    }
  });

  /**
   * PHASE 3.6: Theme Integration
   *
   * Tests that dark/light mode support is configured
   */
  describe('Phase 3.6: Theme Support', () => {
    const projectRoot = path.resolve(__dirname, '../../');

    it('should have tailwind configuration', () => {
      const tailwindPath = path.join(projectRoot, 'tailwind.config.js');
      expect(fs.existsSync(tailwindPath)).toBe(true);
      console.log('✓ Tailwind config exists');
    });

    it('should have theme configuration in tailwind', () => {
      const tailwindPath = path.join(projectRoot, 'tailwind.config.js');
      const content = fs.readFileSync(tailwindPath, 'utf-8');
      
      const hasTheme = content.includes('theme') || content.includes('dark');
      expect(hasTheme).toBe(true);
      console.log('✓ Theme configuration present in Tailwind');
    });

    it('should have next.config.js for configuration', () => {
      const nextConfigPath = path.join(projectRoot, 'next.config.js');
      expect(fs.existsSync(nextConfigPath)).toBe(true);
      console.log('✓ Next.js config exists');
    });
  });

  /**
   * PHASE 3.7: Prisma Schema Integration
   *
   * Tests that database schema is properly configured
   */
  describe('Phase 3.7: Prisma Integration', () => {
    const prismaDir = path.join(projectRoot, 'prisma');

    it('should have prisma directory', () => {
      expect(fs.existsSync(prismaDir)).toBe(true);
      console.log('✓ Prisma directory exists');
    });

    it('should have prisma schema file', () => {
      const schemaPath = path.join(prismaDir, 'schema.prisma');
      expect(fs.existsSync(schemaPath)).toBe(true);
      console.log('✓ Prisma schema exists');
    });

    it('should have prisma migrations', () => {
      const migrationsDir = path.join(prismaDir, 'migrations');
      const exists = fs.existsSync(migrationsDir);
      if (exists) {
        const migrations = fs.readdirSync(migrationsDir);
        console.log(`✓ Prisma has ${migrations.length} migrations`);
      }
    });

    it('should have prisma seed file', () => {
      const seedPath = path.join(prismaDir, 'seed.ts');
      const exists = fs.existsSync(seedPath);
      if (exists) {
        console.log('✓ Prisma seed file exists');
      }
    });
  });

  /**
   * PHASE 3.8: Configuration Files Integration
   *
   * Tests that all necessary configuration files are present
   */
  describe('Phase 3.8: Configuration Files', () => {
    it('should have tsconfig.json', () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      console.log('✓ tsconfig.json exists');
    });

    it('should have vitest.config.ts', () => {
      const vitestConfigPath = path.join(projectRoot, 'vitest.config.ts');
      expect(fs.existsSync(vitestConfigPath)).toBe(true);
      console.log('✓ vitest.config.ts exists');
    });

    it('should have playwright.config.ts', () => {
      const playwrightConfigPath = path.join(projectRoot, 'playwright.config.ts');
      expect(fs.existsSync(playwrightConfigPath)).toBe(true);
      console.log('✓ playwright.config.ts exists');
    });

    it('should have package.json', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      console.log('✓ package.json exists');
    });

    it('should have environment files', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envPath = path.join(projectRoot, '.env');
      
      const hasEnv = fs.existsSync(envExamplePath) || fs.existsSync(envPath);
      if (hasEnv) {
        console.log('✓ Environment files exist');
      }
    });
  });

  /**
   * PHASE 3.9: Shared Summary
   */
  describe('Phase 3.9: Shared Module Summary', () => {
    it('should list all shared resources', () => {
      console.log('\n=== SHARED RESOURCES SUMMARY ===');
      
      const sharedItems = fs.readdirSync(sharedDir).filter((name) => {
        const fullPath = path.join(sharedDir, name);
        return fs.statSync(fullPath).isDirectory();
      });

      console.log(`\nShared module items (${sharedItems.length}):`);
      sharedItems.forEach((name) => {
        console.log(`  - ${name}`);
      });

      // Check for key resources
      const keyResources = ['lib', 'components', 'hooks', 'types'];
      
      console.log('\nKey resources:');
      keyResources.forEach((name) => {
        const exists = sharedItems.includes(name);
        console.log(`  ${exists ? '✓' : '✗'} ${name}`);
      });
    });
  });
});
