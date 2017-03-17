/// <reference types="es6-promise" />
import { IAutoScalerImplementation, WorkerKey, WorkerInstance, IWorkersLaunchRequest, AutoScalerImplementationInfo } from 'autoscalable-grid';
import { ImplementationBase, ConvertToWorkerKeyProc, Options as OptionsBase } from 'grid-autoscaler-impl-base';
import { EC2 } from 'aws-sdk';
export declare type InstanceToWorkerKeyProc = (instance: EC2.Instance) => WorkerKey;
export declare type InstanceMatchesWorkerKeyProc = (instance: EC2.Instance, workerKey: WorkerKey) => boolean;
export interface IWorkerCharacteristic {
    KeyName: string;
    InstanceType: EC2.InstanceType;
    ImageId: string;
    SecurityGroupId: string;
    SubnetId: string;
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
