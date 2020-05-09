import { safeLoad, safeDump } from 'js-yaml';

const checkContentEmpty = (content) => {
    switch (true) {
    case content.custom && Object.keys(content.custom).length > 0:
        // custom response
        return true;
    case content.image && content.image.length > 0:
        // image response
        return true;
    case !!(content.text && content.text.length > 0 && content.buttons):
        // quick reply response with text
        return true;
    case !!(content.buttons && content.buttons.length > 0 && content.buttons[0].title && content.buttons[0].title.length):
        // quick reply response with buttons
        return true;
    case content.text && content.text.length > 0 && !content.buttons:
        // text response
        return true;
    default:
        return false;
    }
};

export const checkResponseEmpty = (response) => {
    let isEmpty = true;
    if (response.metadata) isEmpty = false;
    if (response.key !== 'utter_') isEmpty = false;
    response.values.forEach((value) => {
        if (!isEmpty) return;
        value.sequence.forEach((variation) => {
            const content = safeLoad(variation.content);
            if (checkContentEmpty(content)) {
                isEmpty = false;
            }
        });
    });
    return isEmpty;
};

export const defaultCarouselSlide = () => ({
    title: '', subtitle: '', image_url: '', buttons: [],
});

export const defaultTemplate = (template) => {
    switch (template) {
    case 'TextPayload':
        return { text: '', __typename: 'TextPayload' };
    case 'QuickReplyPayload':
        return {
            __typename: 'QuickReplyPayload',
            text: '',
            buttons: [
                {
                    title: '', type: 'postback', payload: '',
                },
            ],
        };
    case 'CustomPayload':
        return { __typename: 'CustomPayload', custom: '' };
    case 'ImagePayload':
        return {
            image: '', __typename: 'ImagePayload',
        };
    case 'CarouselPayload':
        return {
            template_type: 'generic',
            elements: [defaultCarouselSlide()],
            __typename: 'CarouselPayload',
        };
    default:
        return null;
    }
};

export const createResponseFromTemplate = (type, language, options = {}) => {
    const { key: incommingKey } = options;
    const key = incommingKey || 'utter_';
    const newTemplate = {
        key,
        values: [
            {
                sequence: [{ content: safeDump(defaultTemplate(type)) }],
                lang: language,
            },
        ],
    };
    return newTemplate;
};

const excludeAllButOneKey = (content, key) => {
    const included = ['image', 'buttons', 'elements', 'custom', 'attachment']
        .filter(k => Object.keys(content).includes(k));
    if (key) return included.length === 1 && included[0] === key;
    return included.length === 0;
};

export const parseContentType = (content) => {
    switch (true) {
    // first case is the elsewhere case when embedded fields don't match graphql-defined type
    // could not find a way to use graphql existing parseValue method for given type, so using
    // this less than perfect piece of code
    case ([
        (content.image === undefined || typeof content.image === 'string'),
        (content.buttons === undefined || Array.isArray(content.buttons)),
        (content.elements === undefined || (
            Array.isArray(content.elements)
            && typeof content.template_type === 'string'
            && content.elements.every(el => (
                typeof el === 'object'
                && (el.buttons === undefined || Array.isArray(el.buttons))
                && (el.image_url === undefined || typeof el.image_url === 'string')
                && (el.title === undefined || typeof el.title === 'string')
                && (el.subtitle === undefined || typeof el.subtitle === 'string')
            ))
        )),
    ].some(f => !f)): return 'CustomPayload';
    case excludeAllButOneKey(content, 'image'): return 'ImagePayload';
    case excludeAllButOneKey(content, 'buttons'): return 'QuickReplyPayload';
    case excludeAllButOneKey(content, 'elements'): return 'CarouselPayload';
    case Object.keys(content).includes('text') && excludeAllButOneKey(content): return 'TextPayload';
    default: return 'CustomPayload';
    }
};

export const addContentType = content => ({ ...content, __typename: parseContentType(content) });

export const getDefaultTemplateFromSequence = (sequence) => {
    const content = safeLoad(sequence[0].content);
    const typeName = parseContentType((content));
    return defaultTemplate(typeName);
};

export const addResponseLanguage = (response, language) => {
    const updatedResponse = response;
    const newValue = {
        sequence: [{ content: safeDump(defaultTemplate(parseContentType(safeLoad(response.values[0].sequence[0].content)))) }],
        lang: language,
    };
    updatedResponse.values = [...response.values, newValue];
    return updatedResponse;
};

export const checkMetadataSet = (metadata) => {
    if (!metadata) return false;
    const {
        linkTarget, userInput, forceOpen, forceClose,
    } = metadata;
    if (linkTarget === '_blank'
        && userInput === 'show'
        && forceOpen === false
        && forceClose === false
    ) {
        return false;
    }
    return true;
};

export const addTemplateLanguage = (templates, language) => templates
    .map((template) => {
        const type = parseContentType(safeLoad(template.payload));
        const payload = safeDump(defaultTemplate(type));
        return {
            ...template,
            language,
            payload,
        };
    });
