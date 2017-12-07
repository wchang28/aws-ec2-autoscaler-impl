import { IAutoScalerImplementation, WorkerKey, WorkerInstance, IWorkersLaunchRequest, AutoScalerImplementationInfo } from 'autoscalable-grid';
import { ImplementationBase, ConvertToWorkerKeyProc, Options as OptionsBase, IImplementationSetupBase } from 'grid-autoscaler-impl-base';
import { EC2 } from 'aws-sdk';
export { ConvertToWorkerKeyProc, Options as OptionsBase, IImplementationSetupBase } from 'grid-autoscaler-impl-base';
export declare type InstanceToWorkerKeyProc = (instance: EC2.Instance) => WorkerKey;
export declare type InstanceMatchesWorkerKeyProc = (instance: EC2.Instance, workerKey: WorkerKey) => boolean;
export interface IWorkerCharacteristic {
    KeyName: string;
    InstanceType: EC2.InstanceType;
    ImageId: string;
    SecurityGroupId: string;
    SubnetId: string;
    IAMRoleName?: string;
    NameTag?: string;
}
export interface Options extends OptionsBase {
    WorkerCharacteristic: IWorkerCharacteristic;
}
export declare type ImplementationJSON = Options;
export declare class Implementation extends ImplementationBase implements IAutoScalerImplementation {
    private instanceToWorkerKey;
    private instanceMatchesWorkerKey;
    private __workerCharacteristic;
    private ec2;
    constructor(info: AutoScalerImplementationInfo, workerToKey: ConvertToWorkerKeyProc, instanceToWorkerKey: InstanceToWorkerKeyProc, instanceMatchesWorkerKey: InstanceMatchesWorkerKeyProc, options?: Options);
    readonly WorkerCharacteristic: IWorkerCharacteristic;
    toJSON(): ImplementationJSON;
    LaunchInstances(launchRequest: IWorkersLaunchRequest): Promise<WorkerInstance[]>;
    TerminateInstances(workerKeys: WorkerKey[]): Promise<WorkerInstance[]>;
    private runInstances(NumInstances);
    private describeInstances();
    private lookupInstanceFromWorkerKey(instances, workerKey);
    private terminateInstances(InstanceIds);
}
export interface IWorkerCharacteristicSetup {
    getKeyName: () => Promise<string>;
    setKeyName: (value: string) => Promise<string>;
    getInstanceType: () => Promise<EC2.InstanceType>;
    setInstanceType: (value: EC2.InstanceType) => Promise<EC2.InstanceType>;
    getImageId: () => Promise<string>;
    setImageId: (value: string) => Promise<string>;
    getSecurityGroupId: () => Promise<string>;
    setSecurityGroupId: (value: string) => Promise<string>;
    getSubnetId: () => Promise<string>;
    setSubnetId: (value: string) => Promise<string>;
    getIAMRoleName: () => Promise<string>;
    setIAMRoleName: (value: string) => Promise<string>;
    getNameTag: () => Promise<string>;
    setNameTag: (value: string) => Promise<string>;
    toJSON: () => Promise<IWorkerCharacteristic>;
}
export interface IImplementationSetup extends IImplementationSetupBase {
    readonly WorkerCharacteristic: IWorkerCharacteristicSetup;
    toJSON: () => Promise<ImplementationJSON>;
}
