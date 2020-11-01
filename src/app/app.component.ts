import { Component } from '@angular/core';

import { AuthenticationService } from './services';
import { User } from './models';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent {
  user: User;

  constructor(
    private authenticationService: AuthenticationService
  ) {
    this.authenticationService.user.subscribe(x => this.user = x);
  }

  logout() {
    this.authenticationService.logout();
  }
  
}

