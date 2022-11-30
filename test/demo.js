const VisionWeb = require('../dist/VisionWeb.node.js');
const HttpProvider = VisionWeb.providers.HttpProvider;

const rpc = 'https://vpioneer.infragrid.v.network'
const FullNode = new HttpProvider(rpc);
const SolidityNode = new HttpProvider(rpc);
const EventServer = new HttpProvider(rpc);
const PrivateKey = "";
const visionWeb = new VisionWeb(rpc, rpc, rpc, PrivateKey);
const abi = require('./test.json')
const ADDRESS_PREFIX_REGEX = /^(46)/;
const {utils} = require('ethers')

async function main() {
    // const balance = await visionWeb.vs.getBalance('VLamiuQzTcXrJnRM5R1qfZhTbPUdghKR8g');
    // const balance = await visionWeb.vs.getAccountResources('VLamiuQzTcXrJnRM5R1qfZhTbPUdghKR8g');
    // let unSignTransaction = await visionWeb.transactionBuilder.freezeBalance(
    //     visionWeb.toVdt(1),
    //     35,
    //     'PHOTON',
    //     visionWeb.defaultAddress.hex,
    //     [
    //         {stage: 1, frozen_balance: 1}
    //     ]
    // ).catch(e => {
    //     console.log(e)
    // })
    // const signedTransaction = await visionWeb.transactionBuilder.triggerSmartContract(a.contract_address,a.function_selector,{feeLimit: a.feeLimit, callValue: a.callValue}, a.parameter, 'VRvyUwbTyPjH6fNFHwrAsn84FUPsmEAqY6')
    // .catch(e => {
    //     console.log(e)
    //     return false;
    // });

    // console.log(signedTransaction)
    
    // const signedTransaction = await visionWeb.vs.sign(unSignTransaction, visionWeb.defaultPrivateKey)
    // .catch(e => {
    //     return false;
    // });
    
    // const broadcast = await visionWeb.vs.sendRawTransaction(signedTransaction);
    const abiCoder = new utils.AbiCoder()
    // console.log(broadcast)
    const isString = (string) => {
        return (
            typeof string === "string" ||
            (string &&
                string.constructor &&
                string.constructor.name === "String")
        );
    }
    function toHex(value) {
        return VisionWeb.address.toHex(value);
    }
    const params = [
        '460215df22b757dF0c8b5A1e12e2BF0950446399C3',
        'VArFUeojBjs9y6xPTzCEjXMRifo4XLh7kj', // 0x0215df22b757dF0c8b5A1e12e2BF0950446399C3  支持0x 46 v地址，最终都转换为0x
        '0xAB4BC354E564C41A31BEF90E0116BF52F512122C',
        '0xCAD4582EE178D701E6C2BBE16C40EB2CA8F88728',
        '0x8625103ebbae7886775c524e3507f67a58de0dfd',
        '800000000000000000',
        '32500000000000000',
        '400000000000000000',
        '0',
        '800000000000000000',
        '35000000000000000',
        '250000000000000000',
        '15000000000000000',
        '500000000000000000',
        '1000000000000000',
        0,
        0,
        '1000000000000000000',
        '1000000000000000000',
        '5000000000000000000000000',
        [
          [
            '0x51A9A6B1F98DEA3E448CFDD33FCBF752F3F6B5CD',
            '0xCB4E4FCD38769E0753F5520B8857F72A3BD2D8FC',
            '18',
            '825000000000000000',
            '895000000000000000',
            '950000000000000000',
            '1000000000000000000000000'
          ],
          [
            '0x750A6BE6044F56F17AAB00A2BE58B1763E6770E3',
            '0x6E5A2AC1EC31C728C1725407638CF3E92B4A1A6A',
            '18',
            '700000000000000000',
            '770000000000000000',
            '950000000000000000',
            '125000000000000000000000'
          ],
          [
            '0x1CA39F95B9C591976574E8105334520DA9272F62',
            '0xC0A78530B991AC4BDF22E640641D4C348BD99452',
            '18',
            '650000000000000000',
            '700000000000000000',
            '930000000000000000',
            '1250000000000000000000000'
          ],
          [
            '4642AFAE5DE103C4290001888B1E0F89425DE81E4C',
            '0x0ED77AAB0171256260F95DC67ED6904CCD482439',
            '6',
            '650000000000000000',
            '700000000000000000',
            '930000000000000000',
            '10000000000000'
          ]
        ]
      ]
    const inputinit = abi.inputs

    let parameters = [
        {type: 'address', value: '460215df22b757df0c8b5a1e12e2bf0950446399c3'}, 
        {
        type: 'tuple',
        value: params
    }]

    const resolveType = (inputsObj) => { // values, inputs(includes types)
        const typearr = inputsObj?.components || [] // types
        const type = inputsObj?.type
        if(type === 'tuple') {
            const newarr = typearr.map((comp, tindex) => comp.type.indexOf('tuple[') > -1 ? resolveType(typearr?.[tindex]): comp.type)
            return `tuple(${newarr.join(',')})`
        } 
        else if (/vrcToken/.test()) {
            return  type.replace(/vrcToken/, "uint256");
        }
        else if(type.indexOf('tuple[') > -1) {
            return `tuple(${typearr.map(({type})=>type).join(',')})[]`
        } else return type
    }
    const resolveValue = (arr = [], inputs) => {
        const values = [];
        for (let i = 0; i < arr.length; i++) {
            let { type, value } = arr[i];
 
            if (!type || !isString(type) || !type.length){
                console.error("Invalid parameter type provided: " + type)
                return 
            }

            if (type === "address") // address
                value = toHex(value).replace(ADDRESS_PREFIX_REGEX, "0x");

            else if (type == "address[]") // address array
                value = value.map((v) =>
                    toHex(v).replace(ADDRESS_PREFIX_REGEX, "0x")
                );

            else if(type === "tuple") { // tuple
                const comps = inputs?.[i]?.components || []
                value =  resolveValue(comps.map((i,index)=>({type:i.type, value: value?.[index]})), comps)
            }

            else if (type.indexOf("tuple[") > -1 ) { // tuple array
                const comps = inputs?.[i]?.components || []
                value = value.map(item=>resolveValue(item.map((j,subindex)=>({type: comps?.[subindex]?.type, value: j})), comps))
            }
            values.push(value);
           
        }
        return values
        
    }
    const types = inputinit.map(item=>resolveType(item))
    const values = resolveValue(parameters, inputinit)

    parameters = abiCoder
                    .encode(types, values)
                    .replace(/^(0x)/, "");
}

main();