// Sets an account's password from the terminal (e.g. for an account created before logins existed).
//
//   npm run set-password -- you@example.com
//
// The password is typed at a hidden prompt, so it never appears in shell history.
require('dotenv').config({ quiet: true });

const readline = require('node:readline');
const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/features/auth/auth.service');
const validate = require('../src/lib/validate');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: npm run set-password -- <email>');

  const { rows: [user] } = await pool.query(
    'SELECT id, email FROM public.users WHERE lower(email) = lower($1)',
    [email]
  );
  if (!user) throw new Error(`No account with email ${email} in ${process.env.DB_NAME}`);

  const password = validate.password(await promptHidden(`New password for ${user.email}: `));
  if (password !== await promptHidden('Repeat it: ')) throw new Error('Passwords did not match');

  await pool.query(
    'UPDATE public.users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [user.id, await hashPassword(password)]
  );
  console.log(`Password updated for ${user.email} in ${process.env.DB_NAME}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
