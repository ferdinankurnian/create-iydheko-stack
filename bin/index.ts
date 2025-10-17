#!/usr/bin/env node
import { Command } from 'commander';
import { run } from '../src';

const program = new Command();
program
  .name('create-iydheko-stack')
  .description('A quick template starter by Iydheko')
  .argument('[projectName]', 'name of the project')
  .action(run);

program.parse();
