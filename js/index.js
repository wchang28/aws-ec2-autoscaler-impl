"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var grid_autoscaler_impl_base_1 = require("grid-autoscaler-impl-base");
var aws_sdk_1 = require("aws-sdk");
var events = require("events");
var WorkerCharacteristic = (function (_super) {
    __extends(WorkerCharacteristic, _super);
    function WorkerCharacteristic(characteristic) {
        var _this = _super.call(this) || this;
        _this.__KeyName = characteristic.KeyName;
        _this.__InstanceType = characteristic.InstanceType;
        _this.__ImageId = characteristic.ImageId;
        _this.__SecurityGroupId = characteristic.SecurityGroupId;
        _this.__SubnetId = characteristic.SubnetId;
        return _this;
    }
    Object.defineProperty(WorkerCharacteristic.prototype, "KeyName", {
        get: function () { return this.__KeyName; },
        set: function (newValue) {
            if (newValue !== this.__KeyName) {
                this.__KeyName = newValue;
                this.emit('change');
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WorkerCharacteristic.prototype, "InstanceType", {
        get: function () { return this.__InstanceType; },
        set: function (newValue) {
            if (newValue !== this.__InstanceType) {
                this.__InstanceType = newValue;
                this.emit('change');
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WorkerCharacteristic.prototype, "ImageId", {
        get: function () { return this.__ImageId; },
        set: function (newValue) {
            if (newValue !== this.__ImageId) {
                this.__ImageId = newValue;
                this.emit('change');
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WorkerCharacteristic.prototype, "SecurityGroupId", {
        get: function () { return this.__SecurityGroupId; },
        set: function (newValue) {
            if (newValue !== this.__SecurityGroupId) {
                this.__SecurityGroupId = newValue;
                this.emit('change');
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WorkerCharacteristic.prototype, "SubnetId", {
        get: function () { return this.__SubnetId; },
        set: function (newValue) {
            if (newValue !== this.__SubnetId) {
                this.__SubnetId = newValue;
                this.emit('change');
            }
        },
        enumerable: true,
        configurable: true
    });
    WorkerCharacteristic.prototype.toJSON = function () {
        return {
            KeyName: this.KeyName,
            InstanceType: this.InstanceType,
            ImageId: this.ImageId,
            SecurityGroupId: this.__SecurityGroupId,
            SubnetId: this.SubnetId
        };
    };
    return WorkerCharacteristic;
}(events.EventEmitter));
var Implementation = (function (_super) {
    __extends(Implementation, _super);
    function Implementation(info, workerToKey, instanceToWorkerKey, instanceMatchesWorkerKey, options) {
        var _this = _super.call(this, info, workerToKey, { CPUsPerInstance: options.CPUsPerInstance }) || this;
        _this.instanceToWorkerKey = instanceToWorkerKey;
        _this.instanceMatchesWorkerKey = instanceMatchesWorkerKey;
        _this.__workerCharacteristic = new WorkerCharacteristic(options.WorkerCharacteristic);
        _this.__workerCharacteristic.on("change", function () {
            _this.emit("change");
        });
        _this.ec2 = new aws_sdk_1.EC2();
        return _this;
    }
    Object.defineProperty(Implementation.prototype, "WorkerCharacteristic", {
        get: function () { return this.__workerCharacteristic; },
        enumerable: true,
        configurable: true
    });
    Implementation.prototype.toJSON = function () {
        return {
            CPUsPerInstance: this.CPUsPerInstance,
            WorkerCharacteristic: this.__workerCharacteristic.toJSON()
        };
    };
    Implementation.prototype.LaunchInstances = function (launchRequest) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.runInstances(launchRequest.NumInstances)
                .then(function (reservation) {
                if (reservation && reservation.Instances && reservation.Instances.length > 0) {
                    var workerInstances = [];
                    for (var i in reservation.Instances) {
                        var instance = reservation.Instances[i];
                        if (instance) {
                            var WorkerKey = _this.instanceToWorkerKey(instance);
                            if (WorkerKey && instance.InstanceId)
                                workerInstances.push({ WorkerKey: WorkerKey, InstanceId: instance.InstanceId });
                        }
                    }
                    resolve(workerInstances.length > 0 ? workerInstances : null);
                }
                else
                    resolve(null);
            }).catch(function (err) {
                reject(err);
            });
        });
    };
    Implementation.prototype.TerminateInstances = function (workerKeys) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var mapInstanceId2WorkerKey = {}; // map from instance id to worker key
            _this.describeInstances()
                .then(function (instances) {
                var InstanceIds = [];
                for (var i in workerKeys) {
                    var workerKey = workerKeys[i]; // workerKey is the remote address
                    var instance = _this.lookupInstanceFromWorkerKey(instances, workerKey);
                    if (instance && instance.InstanceId) {
                        mapInstanceId2WorkerKey[instance.InstanceId] = workerKey;
                        InstanceIds.push(instance.InstanceId);
                    }
                }
                return _this.terminateInstances(InstanceIds);
            }).then(function (result) {
                if (result && result.TerminatingInstances && result.TerminatingInstances.length > 0) {
                    var workerInstances = [];
                    for (var i in result.TerminatingInstances) {
                        var instance = result.TerminatingInstances[i];
                        if (instance && instance.InstanceId) {
                            var InstanceId = instance.InstanceId;
                            var WorkerKey = mapInstanceId2WorkerKey[InstanceId];
                            if (WorkerKey)
                                workerInstances.push({ InstanceId: InstanceId, WorkerKey: WorkerKey });
                        }
                    }
                    resolve(workerInstances.length > 0 ? workerInstances : null);
                }
                else
                    resolve(null);
            }).catch(function (err) {
                reject(err);
            });
        });
    };
    Implementation.prototype.runInstances = function (NumInstances) {
        var params = {
            ImageId: this.WorkerCharacteristic.ImageId,
            MinCount: NumInstances,
            MaxCount: NumInstances,
            KeyName: this.WorkerCharacteristic.KeyName,
            InstanceType: this.WorkerCharacteristic.InstanceType,
            SecurityGroupIds: [this.WorkerCharacteristic.SecurityGroupId],
            SubnetId: this.WorkerCharacteristic.SubnetId
        };
        return this.ec2.runInstances(params).promise();
    };
    Implementation.prototype.describeInstances = function () {
        var _this = this;
        var p = new Promise(function (resolve, reject) {
            var instances = {};
            var callback = function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    for (var i in data.Reservations) {
                        for (var j in data.Reservations[i].Instances) {
                            var instance = data.Reservations[i].Instances[j];
                            instances[instance.InstanceId] = instance;
                        }
                    }
                    if (data.NextToken) {
                        _this.ec2.describeInstances({ NextToken: data.NextToken }, callback);
                    }
                    else {
                        resolve(instances);
                    }
                }
            };
            _this.ec2.describeInstances(callback);
        });
        return p;
    };
    Implementation.prototype.lookupInstanceFromWorkerKey = function (instances, workerKey) {
        for (var InstanceId in instances) {
            var instance = instances[InstanceId];
            if (instance && this.instanceMatchesWorkerKey(instance, workerKey))
                return instance;
        }
        return null;
    };
    Implementation.prototype.terminateInstances = function (InstanceIds) {
        if (InstanceIds && InstanceIds.length > 0) {
            var params = {
                InstanceIds: InstanceIds
            };
            return this.ec2.terminateInstances(params).promise();
        }
        else
            Promise.resolve(null);
    };
    return Implementation;
}(grid_autoscaler_impl_base_1.ImplementationBase));
exports.Implementation = Implementation;
