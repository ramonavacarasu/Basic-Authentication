import { Component } from '@angular/core';

import { User } from '../models';
import { AuthenticationService } from '../services';

@Component({ templateUrl: 'home.component.html' })
export class HomeComponent {
    
    user: User;

    constructor(private authenticationService: AuthenticationService ) { 
        this.user = this.authenticationService.userValue;
    }
    
}