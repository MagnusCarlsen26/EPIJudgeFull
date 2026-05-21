export interface Judge0Submission {
  language_id: number;
  source_code: string;
  stdin?: string;
  expected_output?: string;
  additional_files?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  max_file_size?: number;
  redirect_stderr_to_stdout?: boolean;
}

export interface Judge0CreateResponse {
  token: string;
}

export interface Judge0Status {
  id: number;
  description: string;
}

export interface Judge0Output {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: Judge0Status;
  time: string | null;
  memory: number | null;
}

export interface Judge0Language {
  id: number;
  name: string;
}
