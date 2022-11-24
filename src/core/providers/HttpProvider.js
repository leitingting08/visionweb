import axios from 'axios';
import utils from 'utils';
import fetchs from './fetch';

export default class HttpProvider {
    constructor(host, timeout = 30000, user = false, password = false, headers = {}, statusPage = '/') {
        if (!utils.isValidURL(host))
            throw new Error('Invalid URL provided to HttpProvider');

        if (isNaN(timeout) || timeout < 0)
            throw new Error('Invalid timeout duration provided');

        if (!utils.isObject(headers))
            throw new Error('Invalid headers object provided');

        host = host.replace(/\/+$/, '');

        this.host = host;
        this.timeout = timeout;
        this.user = user;
        this.password = password;
        this.headers = headers;
        this.statusPage = statusPage;
        if (process.metadata && process.metadata.isExtension) {
            this.instance = fetchs.create({
                baseURL: host,
                timeout: timeout,
                headers: headers,
                auth: user && {
                    user,
                    password
                },
            })
        } else {
            this.instance = axios.create({
                baseURL: host,
                timeout: timeout,
                headers: headers,
                auth: user && {
                    user,
                    password
                },
            });
        }
        
    }

    setStatusPage(statusPage = '/') {
        this.statusPage = statusPage;
    }

    async isConnected(statusPage = this.statusPage) {
        return this.request(statusPage).then(data => {
            return utils.hasProperties(data, 'blockID', 'block_header');
        }).catch(() => false);
    }

    request(url, payload = {}, method = 'get') {
        method = method.toLowerCase();

        return this.instance.request({
            data: method == 'post' && Object.keys(payload).length ? payload : null,
            params: method == 'get' && payload,
            url,
            method
        }).then(({data}) => data);
    }
};
