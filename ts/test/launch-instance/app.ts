// Note:
// set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env. variables before running this script
import * as fs from "fs";
import * as AWS from 'aws-sdk';
import {EC2} from 'aws-sdk';
import {IWorkerCharacteristic} from "../../";

let region = process.argv[2];
if (!region) {
    console.error("regions is not specified");
    process.exit(1);
}

let characteristicFile = process.argv[3];
if (!characteristicFile) {
    console.error("worker characteristic json file is not specified");
    process.exit(1);
}

AWS.config.region = region;

let ec2 = new EC2();

function launchInstances(NumInstances: number, WorkerCharacteristic: IWorkerCharacteristic) : Promise<EC2.Reservation> {
    let params: EC2.RunInstancesRequest = {
        ImageId: WorkerCharacteristic.ImageId
        ,MinCount: NumInstances
        ,MaxCount: NumInstances
        ,KeyName: WorkerCharacteristic.KeyName
        ,InstanceType: WorkerCharacteristic.InstanceType
        ,SecurityGroupIds: [WorkerCharacteristic.SecurityGroupId]
        ,SubnetId: WorkerCharacteristic.SubnetId
        ,IamInstanceProfile: (WorkerCharacteristic.IAMRoleName ? {Name: WorkerCharacteristic.IAMRoleName} : null)
    };
    return ec2.runInstances(params).promise();
}

let WorkerCharacteristic : IWorkerCharacteristic = JSON.parse(fs.readFileSync(characteristicFile, "utf8"));

launchInstances(1, WorkerCharacteristic)
.then((ret: any) => {
    console.log(JSON.stringify(ret, null, 2));
}).catch((err: any) => {
    console.log("!!! Error: " + JSON.stringify(err));
});