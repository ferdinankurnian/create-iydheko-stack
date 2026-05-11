import path from 'path';
import prompts from 'prompts';
import { styleText } from 'util';
import { detectPackageManager } from './utils/pm';
import { scaffold } from './steps/scaffold';
import { finalize } from './steps/finalize';

export async function run(projectNameFromArgs?: string) {
  const logo = String.raw`
      _     
  ___| |___ 
 / __| / __|
| (__| \__ \
 \___|_|___/
     |_|    

create-iydheko-stack
`;
  console.log(styleText('blue', logo));

  try {
    const { pm } = detectPackageManager();

    let projectName = projectNameFromArgs;

    if (!projectName) {
      const res = await prompts(
        {
          type: 'text',
          name: 'name',
          message: 'What is the name of your project?',
          initial: 'my-project',
        },
        {
          onCancel: () => {
            console.log(styleText('yellow', '[◉] Cancelled?? okay, fine!'));
            process.exit(0);
          },
        }
      );
      if (!res.name) {
        console.log(styleText('red', '[◉] Project name cannot be empty.'));
        process.exit(1);
      }
      projectName = res.name;
    }

    const root = path.join(process.cwd(), projectName!);

    await scaffold(projectName!, pm);
    await finalize(root, pm);

    console.log(styleText('green', `[◉] Congrats! ${projectName} is ready to cook!`));
    console.log(styleText('blue', `[◉] Now, type: cd ${projectName} && ${pm} run dev`));
  } catch (error) {
    console.log();
    console.error(styleText('red', `[◉] Owh noo, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}
