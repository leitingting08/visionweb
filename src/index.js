import providers from "core/providers";
import utils from "utils";
import BigNumber from "bignumber.js";
import EventEmitter from "eventemitter3";
import { version } from "../package.json";
import semver from "semver";
import injectpromise from "injectpromise";
import TransactionBuilder from "core/transactionBuilder";
import Vs from "core/vs";
import Contract from "core/contract";
import Plugin from "core/plugin";
import Event from "core/event";
import SideChain from "core/sidechain";
import { keccak256 } from "utils/ethersUtils";
import { ADDRESS_PREFIX } from "config/address";
import createKeccakHash from 'keccak';
import { getAddress } from "utils/ethersUtils";

const DEFAULT_VERSION = "1.0.0";

const FEE_LIMIT = 20000000;

export default class VisionWeb extends EventEmitter {
    static providers = providers;
    static BigNumber = BigNumber;
    static TransactionBuilder = TransactionBuilder;
    static Vs = Vs;
    static Contract = Contract;
    static Plugin = Plugin;
    static Event = Event;
    static version = version;
    static utils = utils;

    constructor(
        options = false,
        // for retro-compatibility:
        solidityNode = false,
        eventServer = false,
        sideOptions = false,
        privateKey = false
    ) {
        super();

        let fullNode;

        if (
            typeof options === "object" &&
            (options.fullNode || options.fullHost)
        ) {
            fullNode = options.fullNode || options.fullHost;
            sideOptions = solidityNode;
            solidityNode = options.solidityNode || options.fullHost;
            eventServer = options.eventServer || options.fullHost;
            privateKey = options.privateKey;
        } else {
            fullNode = options;
        }
        if (utils.isString(fullNode))
            fullNode = new providers.HttpProvider(fullNode);

        if (utils.isString(solidityNode))
            solidityNode = new providers.HttpProvider(solidityNode);

        if (utils.isString(eventServer))
            eventServer = new providers.HttpProvider(eventServer);

        this.event = new Event(this);
        this.transactionBuilder = new TransactionBuilder(this);
        this.vs = new Vs(this);
        this.plugin = new Plugin(this, options);
        this.utils = utils;

        this.setFullNode(fullNode);
        this.setSolidityNode(solidityNode);
        this.setEventServer(eventServer);

        this.providers = providers;
        this.BigNumber = BigNumber;

        this.defaultBlock = false;
        this.defaultPrivateKey = false;
        this.defaultAddress = {
            hex: false,
            base58: false,
        };

        [
            "sha3",
            "toHex",
            "toUtf8",
            "fromUtf8",
            "toAscii",
            "fromAscii",
            "toDecimal",
            "fromDecimal",
            "toVdt",
            "fromVdt",
            "toBigNumber",
            "isAddress",
            "createAccount",
            "address",
            "version",
        ].forEach((key) => {
            this[key] = VisionWeb[key];
        });
        // for sidechain
        if (
            typeof sideOptions === "object" &&
            (sideOptions.fullNode || sideOptions.fullHost)
        ) {
            this.sidechain = new SideChain(
                sideOptions,
                VisionWeb,
                this,
                privateKey
            );
        } else {
            privateKey = privateKey || sideOptions;
        }

        if (privateKey) this.setPrivateKey(privateKey);
        this.fullnodeVersion = DEFAULT_VERSION;
        this.feeLimit = FEE_LIMIT;
        this.injectPromise = injectpromise(this);
    }

    async getFullnodeVersion() {
        try {
            const nodeInfo = await this.vs.getNodeInfo();
            this.fullnodeVersion = nodeInfo.configNodeInfo.codeVersion;
            if (this.fullnodeVersion.split(".").length === 2) {
                this.fullnodeVersion += ".0";
            }
        } catch (err) {
            this.fullnodeVersion = DEFAULT_VERSION;
        }
    }

    setDefaultBlock(blockID = false) {
        if ([false, "latest", "earliest", 0].includes(blockID)) {
            return (this.defaultBlock = blockID);
        }

        if (!utils.isInteger(blockID) || !blockID)
            throw new Error("Invalid block ID provided");

        this.defaultBlock = Math.abs(blockID);
    }

    setPrivateKey(privateKey) {
        try {
            this.setAddress(this.address.fromPrivateKey(privateKey));
        } catch {
            throw new Error("Invalid private key provided");
        }

        this.defaultPrivateKey = privateKey;
        this.emit("privateKeyChanged", privateKey);
    }

    setAddress(address) {
        if (!this.isAddress(address))
            throw new Error("Invalid address provided");

        const hex = this.address.toHex(address);
        const base58 = this.address.fromHex(address);

        if (
            this.defaultPrivateKey &&
            this.address.fromPrivateKey(this.defaultPrivateKey) !== base58
        )
            this.defaultPrivateKey = false;

        this.defaultAddress = {
            hex,
            base58,
        };

        this.emit("addressChanged", { hex, base58 });
    }

    fullnodeSatisfies(version) {
        return semver.satisfies(this.fullnodeVersion, version);
    }

    isValidProvider(provider) {
        return Object.values(providers).some(
            (knownProvider) => provider instanceof knownProvider
        );
    }

    setFullNode(fullNode) {
        if (utils.isString(fullNode))
            fullNode = new providers.HttpProvider(fullNode);

        if (!this.isValidProvider(fullNode))
            throw new Error("Invalid full node provided");

        this.fullNode = fullNode;
        this.fullNode.setStatusPage("wallet/getnowblock");

        this.getFullnodeVersion();
    }

    setSolidityNode(solidityNode) {
        if (utils.isString(solidityNode))
            solidityNode = new providers.HttpProvider(solidityNode);

        if (!this.isValidProvider(solidityNode))
            throw new Error("Invalid solidity node provided");

        this.solidityNode = solidityNode;
        this.solidityNode.setStatusPage("walletsolidity/getnowblock");
    }

    setEventServer(...params) {
        this.event.setServer(...params);
    }

    currentProviders() {
        return {
            fullNode: this.fullNode,
            solidityNode: this.solidityNode,
            eventServer: this.eventServer,
        };
    }

    currentProvider() {
        return this.currentProviders();
    }

    getEventResult(...params) {
        if (typeof params[1] !== "object") {
            params[1] = {
                sinceTimestamp: params[1] || 0,
                eventName: params[2] || false,
                blockNumber: params[3] || false,
                size: params[4] || 20,
                page: params[5] || 1,
            };
            params.splice(2, 4);

            if (!utils.isFunction(params[2])) {
                if (utils.isFunction(params[1].page)) {
                    params[2] = params[1].page;
                    params[1].page = 1;
                } else if (utils.isFunction(params[1].size)) {
                    params[2] = params[1].size;
                    params[1].size = 20;
                    params[1].page = 1;
                }
            }
        }

        return this.event.getEventsByContractAddress(...params);
    }

    getEventByTransactionID(...params) {
        return this.event.getEventsByTransactionID(...params);
    }

    contract(abi = [], address = false) {
        return new Contract(this, abi, address);
    }

    static get address() {
        return {
            fromHex(address) {
                if (!utils.isHex(address)) return address;

                return utils.crypto.getBase58CheckAddress(
                    utils.code.hexStr2byteArray(
                        address.replace(/^0x/, ADDRESS_PREFIX)
                    )
                );
            },
            toHex(address) {
                if (utils.isHex(address))
                    return address.toLowerCase().replace(/^0x/, ADDRESS_PREFIX);

                return utils.code
                    .byteArray2hexStr(utils.crypto.decodeBase58Address(address))
                    .toLowerCase();
            },
            fromPrivateKey(privateKey) {
                try {
                    return utils.crypto.pkToAddress(privateKey);
                } catch {
                    return false;
                }
            },
            fromEth(address) {
                if (!address || address.indexOf('0x') !== 0) {
                    return false;
                }
                try {
                    address = address.toLowerCase().replace('0x', '')
                    let hash = createKeccakHash('keccak256').update(address).digest('hex')
                    let ret = '46'
                    for (let i = 0; i < address.length; i++) {
                        if (parseInt(hash[i], 16) >= 8) {
                        ret += address[i].toUpperCase()
                        } else {
                        ret += address[i]
                        }
                    }
                    return VisionWeb.address.fromHex(ret);
                } catch {
                    return false;
                }
            },
            toEth(address){
                if (VisionWeb.isAddress(address)) {
                    return getAddress(VisionWeb.address.toHex(address).replace(/^46/, '0x')) ;
                }
                return false;
            }
        };
    }

    static sha3(string, prefix = true) {
        return (
            (prefix ? "0x" : "") +
            keccak256(Buffer.from(string, "utf-8")).toString().substring(2)
        );
    }

    static toHex(val) {
        if (utils.isBoolean(val)) return VisionWeb.fromDecimal(+val);

        if (utils.isBigNumber(val)) return VisionWeb.fromDecimal(val);

        if (typeof val === "object")
            return VisionWeb.fromUtf8(JSON.stringify(val));

        if (utils.isString(val)) {
            if (/^(-|)0x/.test(val)) return val;

            if (!isFinite(val) || /^\s*$/.test(val))
                return VisionWeb.fromUtf8(val);
        }

        let result = VisionWeb.fromDecimal(val);
        if (result === "0xNaN") {
            throw new Error(
                "The passed value is not convertible to a hex string"
            );
        } else {
            return result;
        }
    }

    static toUtf8(hex) {
        if (utils.isHex(hex)) {
            hex = hex.replace(/^0x/, "");
            return Buffer.from(hex, "hex").toString("utf8");
        } else {
            throw new Error("The passed value is not a valid hex string");
        }
    }

    static fromUtf8(string) {
        if (!utils.isString(string)) {
            throw new Error("The passed value is not a valid utf-8 string");
        }
        return "0x" + Buffer.from(string, "utf8").toString("hex");
    }

    static toAscii(hex) {
        if (utils.isHex(hex)) {
            let str = "";
            let i = 0,
                l = hex.length;
            if (hex.substring(0, 2) === "0x") {
                i = 2;
            }
            for (; i < l; i += 2) {
                let code = parseInt(hex.substr(i, 2), 16);
                str += String.fromCharCode(code);
            }
            return str;
        } else {
            throw new Error("The passed value is not a valid hex string");
        }
    }

    static fromAscii(string, padding) {
        if (!utils.isString(string)) {
            throw new Error("The passed value is not a valid utf-8 string");
        }
        return (
            "0x" +
            Buffer.from(string, "ascii").toString("hex").padEnd(padding, "0")
        );
    }

    static toDecimal(value) {
        return VisionWeb.toBigNumber(value).toNumber();
    }

    static fromDecimal(value) {
        const number = VisionWeb.toBigNumber(value);
        const result = number.toString(16);

        return number.isLessThan(0) ? "-0x" + result.substr(1) : "0x" + result;
    }

    static fromVdt(vdt) {
        const vs = VisionWeb.toBigNumber(vdt).div(1_000_000);
        return utils.isBigNumber(vdt) ? vs : vs.toString(10);
    }

    static toVdt(vs) {
        const vdt = VisionWeb.toBigNumber(vs).times(1_000_000);
        return utils.isBigNumber(vs) ? vdt : vdt.toString(10);
    }

    static toBigNumber(amount = 0) {
        if (utils.isBigNumber(amount)) return amount;

        if (utils.isString(amount) && /^(-|)0x/.test(amount))
            return new BigNumber(amount.replace("0x", ""), 16);

        return new BigNumber(amount.toString(10), 10);
    }

    static isAddress(address = false) {
        if (!utils.isString(address)) return false;
        let vAddress = address;
        if (VisionWeb.address.fromEth(address)) {
            vAddress = VisionWeb.address.fromEth(address)
        }
        // Convert HEX to Base58
        if (vAddress.length === 42) {
            try {
                return VisionWeb.isAddress(
                    utils.crypto.getBase58CheckAddress(
                        utils.code.hexStr2byteArray(vAddress) // it throws an error if the address starts with 0x
                    )
                );
            } catch (err) {
                return false;
            }
        }
        try {
            return utils.crypto.isAddressValid(vAddress);
        } catch (err) {
            return false;
        }
    }
    static isEthAddress(address = false) {
        if (!utils.isString(address)) return false;
        if (!address || address.indexOf('0x') !== 0) {
            return false;
        }
        const  vAddress = VisionWeb.address.fromEth(address)
        return VisionWeb.isAddress(vAddress)
    }

    static async createAccount() {
        const account = utils.accounts.generateAccount();

        return account;
    }

    async isConnected(callback = false) {
        if (!callback) return this.injectPromise(this.isConnected);

        return callback(null, {
            fullNode: await this.fullNode.isConnected(),
            solidityNode: await this.solidityNode.isConnected(),
            eventServer:
                this.eventServer && (await this.eventServer.isConnected()),
        });
    }
}
