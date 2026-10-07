/**
 * Micro-harnais de test.
 *
 * Aucune dépendance : la suite est compilée par Vite puis exécutée par Electron
 * en mode Node (voir `npm test`). Suffisant pour vérifier des fonctions pures et
 * des effets sur la base de données.
 */

export class TestFailure extends Error {}

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const cases: TestCase[] = [];

export function test(name: string, run: () => void | Promise<void>): void {
  cases.push({ name, run });
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new TestFailure(message);
  }
}

export function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new TestFailure(
      `${message} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`,
    );
  }
}

export function assertDeepEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);

  if (left !== right) {
    throw new TestFailure(`${message} — attendu ${right}, obtenu ${left}`);
  }
}

/** Vérifie qu'une fonction lève une erreur dont le message contient un fragment. */
export function assertThrows(
  run: () => unknown,
  fragment: string,
  message: string,
): void {
  let thrown: unknown;

  try {
    run();
  } catch (cause) {
    thrown = cause;
  }

  if (thrown === undefined) {
    throw new TestFailure(`${message} — aucune erreur levée`);
  }

  const text = thrown instanceof Error ? thrown.message : String(thrown);

  if (!text.includes(fragment)) {
    throw new TestFailure(
      `${message} — le message "${text}" ne contient pas "${fragment}"`,
    );
  }
}

const marks = new Map<string, number>();

/** Point de mesure pour les tests de performance (300 ms de budget). */
export function mark(name: string): void {
  marks.set(name, performance.now());
}

export function assertUnderBudget(name: string, budgetMs: number): void {
  const start = marks.get(name);

  if (start === undefined) {
    throw new TestFailure(`Mesure "${name}" absente`);
  }

  const elapsed = performance.now() - start;

  if (elapsed > budgetMs) {
    throw new TestFailure(
      `"${name}" a pris ${elapsed.toFixed(0)} ms (budget ${budgetMs} ms)`,
    );
  }
}

export type Suite = {
  name: string;
  register: () => void;
};

export async function runSuites(suites: Suite[]): Promise<number> {
  let passed = 0;
  const failures: { name: string; detail: string }[] = [];

  for (const suite of suites) {
    cases.length = 0;
    suite.register();

    console.log(`\n── ${suite.name} (${cases.length} test(s))`);

    for (const entry of cases) {
      const label = `${suite.name} › ${entry.name}`;

      try {
        await entry.run();
        passed += 1;
        console.log(`  ok   ${entry.name}`);
      } catch (cause) {
        const detail =
          cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);

        failures.push({ name: label, detail });
        console.log(`  FAIL ${entry.name}`);
        console.log(`       ${detail.split('\n')[0]}`);
      }
    }
  }

  console.log(
    `\n${passed} test(s) réussi(s), ${failures.length} échec(s) sur ${passed + failures.length}`,
  );

  if (failures.length > 0) {
    console.log('\nDétail des échecs :');

    for (const failure of failures) {
      console.log(`\n✗ ${failure.name}\n${failure.detail}`);
    }
  }

  return failures.length;
}
