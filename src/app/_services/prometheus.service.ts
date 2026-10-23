// prometheus.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PrometheusService {
  // Base URL for your secured Prometheus API
  private apiUrl = 'https://www.ramisuliman.ru/api/prometheus/';

  constructor(private http: HttpClient) { }

  // Helper to create auth headers
  private createAuthHeaders(username: string, password: string): HttpHeaders {
    const credentials = btoa(`${username}:${password}`);
    return new HttpHeaders({
      'Authorization': `Basic ${credentials}`
    });
  }

  // Method to execute an instant query
  queryInstant(query: string, username: string, password: string): Observable<any> {
    const params = new HttpParams().set('query', query);
    const headers = this.createAuthHeaders(username, password);
    return this.http.get(`${this.apiUrl}/query`, { headers, params });
  }

  // Method to execute a range query (for graphs over time)
  queryRange(query: string, start: number, end: number, step: string, username: string, password: string): Observable<any> {
    let params = new HttpParams()
      .set('query', query)
      .set('start', start.toString())
      .set('end', end.toString())
      .set('step', step);
    const headers = this.createAuthHeaders(username, password);
    return this.http.get(`${this.apiUrl}/query_range`, { headers, params });
  }
}