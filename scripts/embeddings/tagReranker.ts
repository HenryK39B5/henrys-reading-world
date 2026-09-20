import { resolve } from 'node:path';

export const TAG_RERANKER_REPOSITORY = 'Xenova/bge-reranker-base';
export const TAG_RERANKER_REVISION = '280bcc27a84e0b898c251e06fddb25171bd9b101';
export const TAG_RERANKER_MODEL = `${TAG_RERANKER_REPOSITORY}@${TAG_RERANKER_REVISION.slice(0, 7)}-q8`;

type TensorLike = { data: ArrayLike<number> };
type SequenceClassifier = (inputs: unknown) => Promise<{ logits: TensorLike }>;
type Tokenizer = (
    text: string[],
    options: { text_pair: string[]; padding: true; truncation: true },
) => unknown;

type Reranker = {
    tokenizer: Tokenizer;
    model: SequenceClassifier;
};

let rerankerPromise: Promise<Reranker> | undefined;

async function loadReranker(): Promise<Reranker> {
    rerankerPromise ??= (async () => {
        const transformers = await import('@huggingface/transformers');
        transformers.env.cacheDir = resolve(process.cwd(), '.private', 'tags', 'model-cache');
        transformers.env.allowRemoteModels = true;
        transformers.env.allowLocalModels = true;
        const [tokenizer, model] = await Promise.all([
            transformers.AutoTokenizer.from_pretrained(TAG_RERANKER_REPOSITORY, { revision: TAG_RERANKER_REVISION }),
            transformers.AutoModelForSequenceClassification.from_pretrained(TAG_RERANKER_REPOSITORY, {
                dtype: 'q8',
                revision: TAG_RERANKER_REVISION,
            }),
        ]);
        return {
            tokenizer: tokenizer as unknown as Tokenizer,
            model: model as unknown as SequenceClassifier,
        };
    })();
    return rerankerPromise;
}

export async function scoreTagPassagePairs(
    tagDefinitions: readonly string[],
    passages: readonly string[],
): Promise<number[]> {
    if (tagDefinitions.length !== passages.length || tagDefinitions.length === 0) {
        throw new Error('reranker requires equal non-empty tag definition and passage arrays');
    }
    const reranker = await loadReranker();
    const inputs = reranker.tokenizer([...tagDefinitions], {
        text_pair: [...passages],
        padding: true,
        truncation: true,
    });
    const output = await reranker.model(inputs);
    const scores = Array.from(output.logits.data, Number);
    if (scores.length !== tagDefinitions.length || scores.some((score) => !Number.isFinite(score))) {
        throw new Error('reranker returned invalid scores');
    }
    return scores;
}
