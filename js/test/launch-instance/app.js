"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Note:
// set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env. variables before running this script
var fs = require("fs");
var AWS = require("aws-sdk");
var aws_sdk_1 = require("aws-sdk");
var region = process.argv[2];
if (!region) {
    console.error("regions is not specified");
    process.exit(1);
}
var characteristicFile = process.argv[3];
if (!characteristicFile) {
    console.error("worker characteristic json file is not specified");
    process.exit(1);
}
AWS.config.region = region;
var ec2 = new aws_sdk_1.EC2();
function launchInstances(NumInstances, WorkerCharacteristic) {
    var params = {
        ImageId: WorkerCharacteristic.ImageId,
        MinCount: NumInstances,
        MaxCount: NumInstances,
        KeyName: WorkerCharacteristic.KeyName,
        InstanceType: WorkerCharacteristic.InstanceType,
        SecurityGroupIds: [WorkerCharacteristic.SecurityGroupId],
        SubnetId: WorkerCharacteristic.SubnetId,
        IamInstanceProfile: (WorkerCharacteristic.IAMRoleName ? { Name: WorkerCharacteristic.IAMRoleName } : null)
    };
    if (WorkerCharacteristic.NameTag) {
        params.TagSpecifications = [{ ResourceType: "instance", Tags: [{ Key: "Name", Value: WorkerCharacteristic.NameTag }] }];
    }
    return ec2.runInstances(params).promise();
}
var WorkerCharacteristic = JSON.parse(fs.readFileSync(characteristicFile, "utf8"));
launchInstances(1, WorkerCharacteristic)
    .then(function (ret) {
    console.log(JSON.stringify(ret, null, 2));
}).catch(function (err) {
    console.log("!!! Error: " + JSON.stringify(err));
});
//# sourceMappingURL=app.js.map