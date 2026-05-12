import path from "path";
import prompts from "prompts";
import { styleText } from "util";
import { detectPackageManager } from "./utils/pm";
import { scaffold } from "./steps/scaffold";
import { finalize } from "./steps/finalize";

type Framework = "vite-vanilla-ts" | "vite-react";

export async function run(projectNameFromArgs?: string) {
  const logo = String.raw`
create-iydheko-stack`;
  console.log(styleText("blue", logo));

  try {
    const { pm, execCmd } = detectPackageManager();

    let projectName = projectNameFromArgs;
    let framework: Framework = "vite-vanilla-ts";

    if (!projectName) {
      const res = await prompts(
        {
          type: "text",
          name: "name",
          message: "What is the name of your project?",
          initial: "my-project",
        },
        {
          onCancel: () => {
            console.log(styleText("yellow", "[◉] Cancelled?? okay, fine!"));
            process.exit(0);
          },
        },
      );
      if (!res.name) {
        console.log(styleText("red", "[◉] Project name cannot be empty."));
        process.exit(1);
      }
      projectName = res.name;
    }

    const frameworkRes = await prompts(
      {
        type: "select",
        name: "framework",
        message: "Pick a framework",
        choices: [
          { title: "Vite Vanilla (TS)", value: "vite-vanilla-ts" },
          { title: "Vite + React", value: "vite-react" },
        ],
        initial: 0,
      },
      {
        onCancel: () => {
          console.log(styleText("yellow", "[◉] Cancelled?? okay, fine!"));
          process.exit(0);
        },
      },
    );
    framework = (frameworkRes.framework as Framework | undefined) ?? "vite-vanilla-ts";

    const root = path.join(process.cwd(), projectName!);

    await scaffold(projectName!, framework, execCmd);
    await finalize(root, pm);

    console.log(
      styleText("green", `[◉] Congrats! ${projectName} is ready to cook!`),
    );
    console.log(
      styleText("blue", `[◉] Now, type: cd ${projectName} && ${pm} run dev`),
    );
  } catch (error) {
    console.log();
    console.error(
      styleText(
        "red",
        `[◉] Owh noo, an error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
      ),
    );
    process.exit(1);
  }
}
