import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EnvService {
  private values: Record<string, string> = {};

  constructor(private handler: HttpBackend) {}

  async load(): Promise<void> {
    const http = new HttpClient(this.handler);
    try {
      this.values = await firstValueFrom(
        http.get<Record<string, string>>('assets/env.json')
      );
    } catch {
      this.values = {};
    }
  }

  getEnv(key: string): string | undefined {
    return this.values[key];
  }
}
