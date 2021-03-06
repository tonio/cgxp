/**
 * Copyright (c) 2011-2013 by Camptocamp SA
 *
 * CGXP is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * CGXP is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with CGXP.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @requires plugins/Tool.js
 * @include CGXP/widgets/tool/Button.js
 * @include CGXP/widgets/tool/Window.js
 */

/** api: (define)
 *  module = cgxp.plugins
 *  class = Login
 */

Ext.namespace("cgxp.plugins");

/** api: example
 *  Sample code showing how to add a Login plugin to a
 *  `gxp.Viewer`:
 *
 *  .. code-block:: javascript
 *
 *      new gxp.Viewer({
 *          ...
 *          tools: [{
 *              ptype: 'cgxp_login',
 *              actionTarget: 'center.tbar',
 *              toggleGroup: 'maptools',
 *      % if user:
 *              username: "${user.username}",
 *      % endif
 *              loginURL: "${request.route_url('login', path='')}",
 *              logoutURL: "${request.route_url('logout', path='')}",
 *              permalinkId: "permalink",
 *          }]
 *          ...
 *      });
 */

/** api: constructor
 *  .. class:: Login(config)
 *
 *    Provides an action that opens a login form panel.
 */
cgxp.plugins.Login = Ext.extend(gxp.plugins.Tool, {

    /** api: ptype = cgxp_login */
    ptype: "cgxp_login",

    /** api: config[toggleGroup]
     *  The group this toggle button is member of.
     */
    toggleGroup: null,

    /** api: config[loginURL]
     *  URL of the login service.
     */
    loginURL: null,

    /** api: config[logoutURL]
     *  URL of the logout service.
     */
    logoutURL: null,

    /** api: config[username]
     *  Username of currently logged in user.
     */
    username: null,

    /** api: config[actionConfig]
     *  ``Object``
     *  Config object for the action created by this plugin.
     */
    actionConfig: null,

    /** api[config]: extraHtml
     *  ``String``
     *  Some extra HTML code to put below the login form (optional).
     */
    extraHtml: null,

    button: null,
    loginForm: null,

    /** api: config[permalinkId]
     *  ``String``
     *  Id of the permalink tool.
     *  You need to set an id in the permalink plugin config
     */
    permalinkId: null,

    /** api: config[ignoreExistingPermalink]
     *  ``Bool``
     *  if set to true, existing permalink in url are ignored and the permalink 
     *  corresponding to the up-to-date state of the application is used.
     *
     *  Default: false
     */
    ignoreExistingPermalink: false,

    /* i18n */
    authenticationFailureText: "Impossible to connect.",
    loggedAsText: "Logged in as ${user}",
    logoutText: "Logout",
    loginText: "Login",
    usernameText: "Username",
    passwordText: "Password",

    /** api: method[addActions]
     */
    addActions: function() {
        this.button = new Ext.Button({
            text: this.loginText,
            formBind: true,
            handler: this.submitForm,
            scope: this
        });
        this.loginForm = this.createLoginForm();
        var items = [this.loginForm];

        if (this.extraHtml) {
            items.push({
                xtype: 'box',
                html: this.extraHtml
            });
        }

        var loginWindow = new cgxp.tool.Window({
            width: 250,
            items: items
        });
        loginWindow.render(Ext.getBody());

        var loginButton;
        if (this.username) {
            loginButton = [
                new Ext.Toolbar.TextItem({
                    text: OpenLayers.String.format(this.loggedAsText, {user : this.username})
                }),
                new Ext.Button(Ext.apply({
                    text: this.logoutText,
                    handler: function() {
                        Ext.Ajax.request({
                            url: this.logoutURL,
                            success: function() {
                                window.location.href = window.location.href;
                            }
                        });
                    },
                    scope: this
                }, this.actionConfig))
            ];
        } else {
            loginButton = new cgxp.tool.Button(Ext.apply({
                text: this.loginText,
                enableToggle: true,
                toggleGroup: this.toggleGroup,
                window: loginWindow
            }, this.actionConfig));
        }

        return cgxp.plugins.Login.superclass.addActions.apply(this, [loginButton]);
    },

    createLoginForm: function() {
        return new Ext.FormPanel({
            labelWidth: 100,
            width: 230,
            unstyled: true,
            url: this.loginURL,
            defaultType: 'textfield',
            monitorValid: true,
            defaults: {
                enableKeyEvents: true,
                listeners: {
                    specialkey: function(field, el) {
                        if (el.getKey() == Ext.EventObject.ENTER) {
                            this.submitForm();
                        }
                    },
                    scope: this
                }
            },
            items:[{
                fieldLabel: this.usernameText,
                name: 'login',
                applyTo: 'login',
                width: 120,
                allowBlank: false
            }, {
                fieldLabel: this.passwordText,
                name: 'password',
                applyTo: 'password',
                inputType: 'password',
                width: 120,
                allowBlank: false
            }, {
                xtype: 'box',
                ref: 'failureMsg',
                html: this.authenticationFailureText,
                hidden: true
            }],
            buttons:[this.button]
        });
    },

    submitForm: function() {
        this.button.setIconClass('loading');
        this.loginForm.getForm().submit({
            method: 'POST',
            success: function() {
                if (Ext.isIE) {
                    window.external.AutoCompleteSaveForm(this.loginForm.getForm().el.dom);
                }
                window.location = this.getUrl();
            },
            failure: function(form, action) {
                this.button.setIconClass('');
                this.loginForm.getForm().reset();
                this.loginForm.failureMsg.show();
            },
            scope: this
        });
    },

    /**
     * return the url where the user is redirected after login
     * if the current url is already a permalink, use it as it is,
     * otherwise get the permalink
     */
    getUrl: function() {
        /* check if the current url is already a permalink (map_x exists) and 
           also check if all other other required parameters are set */
        var targetUrl;
        var currentUrl = window.location.href;

        if (this.permalinkId == null) {
            alert('permalinkId is missing in your login plugin config.');
            return currentUrl;
        }
        // map_x is used as an indicator of existing permalink
        if (!this.ignoreExistingPermalink && 
              window.location.search.indexOf('map_x') > -1) {
            targetUrl = currentUrl;
        } else {
            if (this.target.tools[this.permalinkId]) {
                targetUrl = this.target.tools[this.permalinkId].permalink;
            } else {
                alert('permalinkId not found, your permalink plugin "id" config is' +
                      ' either missing or wrong');
                targetUrl = currentUrl;
            }
        }
        return targetUrl;
    }

});

Ext.preg(cgxp.plugins.Login.prototype.ptype, cgxp.plugins.Login);
