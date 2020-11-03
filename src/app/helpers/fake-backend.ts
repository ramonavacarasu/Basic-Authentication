import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpEvent, HttpInterceptor, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { delay, materialize, dematerialize, concatMap } from 'rxjs/operators';

//const users: User[] = [{ id: 1, username: 'ramona', password: 'password', firstName: 'Ramona', lastName: 'Vacarasu' }];
const usersKey = 'registration-login';
let users = JSON.parse(localStorage.getItem(usersKey)) || [];

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

        const { url, method, headers, body } = request;

        return handleRoute();

        function handleRoute() {
            switch (true) {
                case url.endsWith('/users/authenticate') && method === 'POST':
                    return authenticate();
                case url.endsWith('/users/authenticatefb') && method === 'POST':
                    return authenticateWithFb();
                case url.endsWith('/users/register') && method === 'POST':
                    return register();
                case url.endsWith('/users') && method === 'GET':
                    return getUsers();
                case url.match(/\/users\/d+$/) && method === 'GET':
                    return getUserById();
                case url.match(/\/users\/d+$/) && method === 'PUT':
                    return updateUser();
                case url.match(/\/users\/d+$/) && method === 'DELETE':
                    return deleteUser();
                default:
                    // pass through any requests not handled above
                    return next.handle(request);
            }    
        }

        // authenticate with facebook

        function authenticateWithFb() {
            const { accessToken } = body;

            return from(new Promise(resolve => {
                fetch(`https://graph.facebook.com/v8.0/me?access_token=${accessToken}`)
                    .then(response => resolve(response.json()));
            })).pipe(concatMap((data: any) => {
                if (data.error) return unauthorized(data.error.message);

                let user = users.find(x => x.username === data.id);
                if (!user) {
                    // create new user if first time logging in
                    user = {
                        id: newUserId(),
                        username: data.id,
                        firstName: data.name,
                        lastName: data.lastName,
                        extraInfo: `This is some extra info about ${data.name} that is saved in the API: ${data.extraInfo}`
                    }
                    users.push(user);
                    localStorage.setItem(usersKey, JSON.stringify(users));
                }

                return ok({
                    ...user,
                    token: generateJwtToken(user)
                });
            }));
        }

        function newUserId() {
            return users.length ? Math.max(...users.map(x => x.id)) + 1 : 1;
        }

        function generateJwtToken(account) {
            // create token that expires in 15 minutes
            const tokenPayload = { 
                exp: Math.round(new Date(Date.now() + 15*60*1000).getTime() / 1000),
                id: account.id
            }
            return `fake-jwt-token.${btoa(JSON.stringify(tokenPayload))}`;
        }


        
        // route functions

        function authenticate() {
            const { username, password } = body;
            const user = users.find(x => x.username === username && x.password === password);
            if (!user) return error('Username or password is incorrect');
            return ok({
                id: newUserId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                extraInfo: user.extraInfo,
               // ...basicDetails(user),
                token: 'fake-jwt-token'
            })
        }

        function register() {
            const user = body;

            if (users.find(x => x.username === user.username)) {
                return  error('Username "' + user.username + '" is already taken')
            }

            user.id = user.length ? Math.max(...users.map(x => x.id)) + 1 : 1;
            users.push(user);
            localStorage.setItem(usersKey, JSON.stringify(users));
            return ok();
        }


        function getUsers() {
            if (!isLoggedIn()) return unauthorized();
            return ok(users);
        }

        function getUserById() {
            if (!isLoggedIn()) return unauthorized();

            let user = users.find(x => x.id === idFromUrl());
            return ok(user);

        }

        function updateUser() {
            if (!isLoggedIn()) return unauthorized();

            let params = body;
            let user = users.find(x => x.id === idFromUrl());

            // only update password if entered
            if (!params.password) {
                delete params.password;
            }

            // update and save user
            Object.assign(user, params);
            localStorage.setItem(usersKey, JSON.stringify(users));

            return ok();
        }

        function deleteUser() {
            if (!isLoggedIn()) return unauthorized();

            users = users.filter(x => x.id !== idFromUrl());
            localStorage.setItem(usersKey, JSON.stringify(users));
            return ok();
        }

        // helper functions

        function ok(body?) {
            return of(new HttpResponse({ status: 200, body }))
            .pipe(delay(500)); // delay observable to simulate server api call
        }

        // call materialize and dematerialize to ensure delay even if an error is thrown (https://github.com/Reactive-Extensions/RxJS/issues/648);
        function error(message) {
            return throwError({ error: { message } })
                .pipe(materialize(), delay(500), dematerialize());
        }

        function unauthorized(message = 'Unauthorized') {
            return throwError({ status: 401, error: { message: 'Unauthorised' } })
                .pipe(materialize(), delay(500), dematerialize());
        }

        function isLoggedIn() {
            //return headers.get('Authorization') === `Basic ${window.btoa('ramona:password')}`;
            return headers.get('Authorization')?.startsWith('Bearer fake-jwt-token');
        }

        function idFromUrl() {
            const urlParts = url.split('/');
            return parseInt(urlParts[urlParts.length - 1]);
        }
    }
}

export let fakeBackendProvider = {
    // use fake backend in place of Http service for backend-less development
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};