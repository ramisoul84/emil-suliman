import { Component, OnInit } from '@angular/core';
import { Header } from "../../components/header/header";
import { Home } from "../../sections/home/home";
import { About } from "../../sections/about/about";
import { Timeline } from "../../sections/timeline/timeline";
import { Cases } from "../../sections/cases/cases";
import { Solidarity } from "../../sections/solidarity/solidarity";
import { Contact } from "../../sections/contact/contact";
import { Footer } from "../../components/footer/footer";
import { AnalyticsService } from '../../_services/analytics.service';

@Component({
  selector: 'app-main',
  imports: [Header, Home, About, Timeline, Cases, Solidarity, Contact, Footer],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main implements OnInit {
  isBlur: boolean = false;

  constructor(
    private analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    this.analyticsService.trackVisit();
  }
}
