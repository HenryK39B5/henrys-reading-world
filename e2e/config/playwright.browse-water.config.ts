import {defineConfig} from '@playwright/test';
import base from './playwright.text-flow.config.ts';
export default defineConfig({...base,testMatch:'browse-water.spec.ts',outputDir:'../../.private/review/browse-water/results-integration'});
