#!/usr/bin/env node
import { Command } from 'commander';
import { run } from '../index';
import { CliOptions } from '../types';

const program = new Command();
program
  .name('create-iydheko-stack')
  .description('Minimal project scaffolder by Iydheko')
  .argument('[projectName]', 'name of the project')
  .option('-s, --simple', 'skip libraries, databases, auth, and deploy prompts')
  .action((projectName?: string, options?: CliOptions) => {
    void run(projectName, options);
  });

program.parse();
