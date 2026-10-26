import {defineConfig} from '@playwright/test';
import base from './playwright.text-flow.config.ts';
export default defineConfig({...base,testMatch:'map-coordinate-polish.spec.ts',outputDir:'../../.private/review/map-coordinate-polish/results-first'});
