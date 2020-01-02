import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { formatError } from '../../lib/utils';
import { Endpoints } from './endpoints.collection';
import { GlobalSettings } from '../globalSettings/globalSettings.collection';
import { checkIfCan } from '../../lib/scopes';

export const getDefaultEndpoints = ({ _id, namespace }) => {
    if (!Meteor.isServer) throw Meteor.Error(401, 'Not Authorized');

    const fields = {
        'settings.private.defaultEndpoints': 1,
        'settings.private.bfApiHost': 1,
        'settings.private.gcpModelsBucket': 1,
        'settings.private.rootUrl': 1,
    };
    const { settings: { private: privateVars = {} } = {} } = GlobalSettings.findOne({}, { fields });
    const {
        defaultEndpoints = '', bfApiHost, rootUrl, actionsServerUrl, gcpModelsBucket,
    } = privateVars;

    return defaultEndpoints
        .replace(/{BF_API_HOST}/g, bfApiHost)
        .replace(/{GCP_MODELS_BUCKET}/g, gcpModelsBucket)
        .replace(/{BF_PROJECT_ID}/g, _id)
        .replace(/{ROOT_URL}/g, process.env.ROOT_URL || rootUrl)
        .replace(/{ACTIONS_URL}/g, process.env.ACTIONS_URL || actionsServerUrl)
        .replace(/{PROJECT_NAMESPACE}/g, namespace);
};

export const createEndpoints = async (project) => {
    if (!Meteor.isServer) throw Meteor.Error(401, 'Not Authorized');
    const endpoints = await getDefaultEndpoints(project);
    if (endpoints) Endpoints.insert({ endpoints, projectId: project._id });
};

export const saveEndpoints = async (endpoints) => {
    try {
        if (!Meteor.isServer) throw Meteor.Error(400, 'Not Authorized');
        return Endpoints.upsert({ projectId: endpoints.projectId }, { $set: { endpoints: endpoints.endpoints } });
    } catch (e) {
        throw formatError(e);
    }
};

if (Meteor.isServer) {
    Meteor.methods({
        'endpoints.save'(endpoints) {
            check(endpoints, Object);
            checkIfCan('project-settings:w', endpoints.projectId);
            return saveEndpoints(endpoints);
        },
    });
}
