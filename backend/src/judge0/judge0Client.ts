import { HttpError } from "../errors/httpError.js";
import type { Judge0CreateResponse, Judge0Language, Judge0Output, Judge0Submission } from "./judge0Types.js";

interface Judge0Config {
  baseUrl: string;
  authToken: string;
  wait: boolean;
}

export class Judge0Client {
  constructor(private readonly config: Judge0Config) {}

  async createSubmission(submission: Judge0Submission): Promise<Judge0CreateResponse> {
    const response = await this.request("/submissions", {
      method: "POST",
      body: JSON.stringify(encodeSubmission(submission))
    }, new URLSearchParams({ base64_encoded: "true", wait: String(this.config.wait) }));

    return response as Judge0CreateResponse;
  }

  async getSubmission(token: string): Promise<Judge0Output> {
    const response = await this.request(`/submissions/${encodeURIComponent(token)}`, {
      method: "GET"
    }, new URLSearchParams({ base64_encoded: "true" }));

    return decodeOutput(response as Judge0Output);
  }

  async getLanguages(): Promise<Judge0Language[]> {
    return this.request("/languages", { method: "GET" }) as Promise<Judge0Language[]>;
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.getLanguages();
      return true;
    } catch {
      return false;
    }
  }

  private async request(path: string, init: RequestInit, query?: URLSearchParams): Promise<unknown> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (query) url.search = query.toString();

    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.config.authToken) headers.set("X-Auth-Token", this.config.authToken);

    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (error) {
      throw new HttpError(502, "JUDGE0_UNAVAILABLE", "Execution service is unavailable.");
    }

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new HttpError(502, "JUDGE0_REJECTED", message || "Execution service rejected the request.");
    }

    return response.json();
  }
}

function encodeSubmission(submission: Judge0Submission): Judge0Submission {
  return Object.fromEntries(
    Object.entries(submission).map(([key, value]) => {
      if (typeof value === "string" && ["source_code", "stdin", "expected_output"].includes(key)) {
        return [key, Buffer.from(value, "utf8").toString("base64")];
      }
      return [key, value];
    })
  ) as unknown as Judge0Submission;
}

function decodeOutput(output: Judge0Output): Judge0Output {
  return {
    ...output,
    stdout: decodeMaybeBase64(output.stdout),
    stderr: decodeMaybeBase64(output.stderr),
    compile_output: decodeMaybeBase64(output.compile_output),
    message: decodeMaybeBase64(output.message)
  };
}

function decodeMaybeBase64(value: string | null): string | null {
  if (!value) return value;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return value;
  }
}
