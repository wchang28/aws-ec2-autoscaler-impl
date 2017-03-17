import {IAutoScalerImplementation, WorkerKey, WorkerInstance, IWorkersLaunchRequest, AutoScalerImplementationInfo} from 'autoscalable-grid';
import {ImplementationBase, ConvertToWorkerKeyProc, Options as OptionsBase, ImplementationSetup as ImplementationBaseSetup} from 'grid-autoscaler-impl-base';
import {EC2} from 'aws-sdk';
import * as events from "events";

export {ConvertToWorkerKeyProc, Options as OptionsBase, ImplementationSetup as ImplementationBaseSetup} from 'grid-autoscaler-impl-base';

type EC2Instances = {[InstanceId: string]: EC2.Instance};

export type InstanceToWorkerKeyProc = (instance: EC2.Instance) => WorkerKey;
export type InstanceMatchesWorkerKeyProc = (instance: EC2.Instance, workerKey: WorkerKey) => boolean;

export interface IWorkerCharacteristic {
    KeyName: string;
    InstanceType: EC2.InstanceType;
    ImageId: string;
    SecurityGroupId: string;
    SubnetId: string;
}

export interface Options extends OptionsBase {
    WorkerCharacteristic: IWorkerCharacteristic
}

class WorkerCharacteristic extends events.EventEmitter implements IWorkerCharacteristic {
    private __KeyName: string;
    private __InstanceType: EC2.InstanceType;
    private __ImageId: string;
    private __SecurityGroupId: string;
    private __SubnetId: string;

    constructor(characteristic: IWorkerCharacteristic) {
        super();
        this.__KeyName = characteristic.KeyName;
        this.__InstanceType = characteristic.InstanceType;
        this.__ImageId = characteristic.ImageId;
        this.__SecurityGroupId = characteristic.SecurityGroupId;
        this.__SubnetId = characteristic.SubnetId;
    }

    get KeyName() : string {return this.__KeyName;}
    set KeyName(newValue: string) {
        if (newValue !== this.__KeyName) {
            this.__KeyName = newValue;
            this.emit('change');
        }
    }
    get InstanceType() : EC2.InstanceType {return this.__InstanceType;}
    set InstanceType(newValue: EC2.InstanceType) {
        if (newValue !== this.__InstanceType) {
            this.__InstanceType = newValue;
            this.emit('change');
        }
    }
    get ImageId() : string {return this.__ImageId;}
    set ImageId(newValue: string) {
        if (newValue !== this.__ImageId) {
            this.__ImageId = newValue;
            this.emit('change');
        }
    }
    get SecurityGroupId() : string {return this.__SecurityGroupId;}
    set SecurityGroupId(newValue: string) {
        if (newValue !== this.__SecurityGroupId) {
            this.__SecurityGroupId = newValue;
            this.emit('change');
        }
    }
    get SubnetId() : string {return this.__SubnetId;}
    set SubnetId(newValue: string) {
        if (newValue !== this.__SubnetId) {
            this.__SubnetId = newValue;
            this.emit('change');
        }
    }
    toJSON(): IWorkerCharacteristic {
        return {
            KeyName: this.KeyName
            ,InstanceType: this.InstanceType
            ,ImageId: this.ImageId
            ,SecurityGroupId: this.__SecurityGroupId
            ,SubnetId: this.SubnetId
        }
    }
}

export type ImplementationJSON = Options;

export class Implementation extends ImplementationBase implements IAutoScalerImplementation {
    private __workerCharacteristic: WorkerCharacteristic
    private ec2: EC2;
    constructor (
        info: AutoScalerImplementationInfo
        ,workerToKey: ConvertToWorkerKeyProc
        ,private instanceToWorkerKey: InstanceToWorkerKeyProc
        ,private instanceMatchesWorkerKey: InstanceMatchesWorkerKeyProc
        ,options?: Options
    ) {
        super(info, workerToKey, {CPUsPerInstance: options.CPUsPerInstance});
        this.__workerCharacteristic = new WorkerCharacteristic(options.WorkerCharacteristic);
        this.__workerCharacteristic.on("change", () => {
            this.emit("change");
        })
        this.ec2 = new EC2();
    }

    get WorkerCharacteristic() : IWorkerCharacteristic {return this.__workerCharacteristic;}
    toJSON(): ImplementationJSON {
        return {
            CPUsPerInstance: this.CPUsPerInstance
            ,WorkerCharacteristic: this.__workerCharacteristic.toJSON()
        }
    }

    LaunchInstances(launchRequest: IWorkersLaunchRequest): Promise<WorkerInstance[]> {
        return new Promise<WorkerInstance[]>((resolve: (value: WorkerInstance[]) => void, reject: (err: any) => void) => {
            this.runInstances(launchRequest.NumInstances)
            .then((reservation: EC2.Reservation) => {
                if (reservation && reservation.Instances && reservation.Instances.length > 0) {
                    let workerInstances: WorkerInstance[] = [];
                    for (let i in reservation.Instances) {
                        let instance = reservation.Instances[i];
                        if (instance) {
                            let WorkerKey = this.instanceToWorkerKey(instance)
                            if (WorkerKey && instance.InstanceId)
                                workerInstances.push({WorkerKey, InstanceId: instance.InstanceId});
                        }
                    }
                    resolve(workerInstances.length > 0 ? workerInstances : null);
                } else
                    resolve(null);
            }).catch((err: any) => {
                reject(err);
            });
        });
    }
    TerminateInstances(workerKeys: WorkerKey[]): Promise<WorkerInstance[]> {
        return new Promise<WorkerInstance[]>((resolve: (value: WorkerInstance[]) => void, reject: (err: any) => void) => {
            let mapInstanceId2WorkerKey: {[InstanceId: string]: WorkerKey} = {};    // map from instance id to worker key
            this.describeInstances()
            .then((instances: EC2Instances) => {
                let InstanceIds: string[] = [];
                for (let i in workerKeys) {
                    let workerKey = workerKeys[i];  // workerKey is the remote address
                    let instance = this.lookupInstanceFromWorkerKey(instances, workerKey);
                    if (instance && instance.InstanceId) {
                        mapInstanceId2WorkerKey[instance.InstanceId] = workerKey;
                        InstanceIds.push(instance.InstanceId);
                    }
                }
                return this.terminateInstances(InstanceIds);
            }).then((result: EC2.TerminateInstancesResult) => {
                if (result && result.TerminatingInstances && result.TerminatingInstances.length > 0) {
                    let workerInstances: WorkerInstance[] = [];
                    for (let i in result.TerminatingInstances) {
                        let instance = result.TerminatingInstances[i];
                        if (instance && instance.InstanceId) {
                            let InstanceId = instance.InstanceId;
                            let WorkerKey: WorkerKey = mapInstanceId2WorkerKey[InstanceId];
                            if (WorkerKey) workerInstances.push({InstanceId, WorkerKey});
                        }
                    }
                    resolve(workerInstances.length > 0 ? workerInstances : null);
                } else
                    resolve(null);
            }).catch((err: any) => {
                reject(err);
            });
        });
    }
    
    private runInstances(NumInstances: number) : Promise<EC2.Reservation> {
        let params: EC2.RunInstancesRequest = {
            ImageId: this.WorkerCharacteristic.ImageId
            ,MinCount: NumInstances
            ,MaxCount: NumInstances
            ,KeyName: this.WorkerCharacteristic.KeyName
            ,InstanceType: this.WorkerCharacteristic.InstanceType
            ,SecurityGroupIds: [this.WorkerCharacteristic.SecurityGroupId]
            ,SubnetId: this.WorkerCharacteristic.SubnetId
        }
        return this.ec2.runInstances(params).promise();
    }
    private describeInstances() : Promise<EC2Instances> {
        let p = new Promise<EC2Instances>((resolve: (value: EC2Instances) => void, reject: (err: any) => void) => {
            let instances: EC2Instances = {};
            let callback = (err: any, data: EC2.Types.DescribeInstancesResult) => {
                if (err) {
                    reject(err);
                } else {
                    for (let i in data.Reservations) {  // for each reservation
                        for (let j in  data.Reservations[i].Instances) {    // for each instance in the reservation
                            let instance = data.Reservations[i].Instances[j];
                                instances[instance.InstanceId] = instance;
                        }
                    }
                    if (data.NextToken) {
                        this.ec2.describeInstances({NextToken: data.NextToken}, callback);
                    } else {
                        resolve(instances);
                    }
                }
            };
            this.ec2.describeInstances(callback);
        });
        return p;
    }
    private lookupInstanceFromWorkerKey(instances: EC2Instances, workerKey: WorkerKey) : EC2.Instance {
        for (let InstanceId in instances) { // for each instance
            let instance = instances[InstanceId];
            if (instance && this.instanceMatchesWorkerKey(instance, workerKey))
                return instance;
        }
        return null;
    }
    private terminateInstances(InstanceIds: string[]) : Promise<EC2.TerminateInstancesResult> {
        if (InstanceIds && InstanceIds.length > 0) {
            let params: EC2.TerminateInstancesRequest = {
                InstanceIds
            };
            return this.ec2.terminateInstances(params).promise()
        } else
            Promise.resolve<EC2.TerminateInstancesResult>(null);
    }
}

export interface ImplementationSetup extends ImplementationBaseSetup {
    getKeyName: () => Promise<string>;
    setKeyName: (value: number) => Promise<string>;
    getInstanceType: () => Promise<EC2.InstanceType>;
    setInstanceType: (value: number) => Promise<EC2.InstanceType>;
    getImageId: () => Promise<string>;
    setImageId: (value: number) => Promise<string>;
    getSecurityGroupId: () => Promise<string>;
    setSecurityGroupId: (value: number) => Promise<string>;
    getSubnetId: () => Promise<string>;
    setSubnetId: (value: number) => Promise<string>;
    toJSON: () => Promise<ImplementationJSON>;
}