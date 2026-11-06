import { RecordService } from '../services/recordService.js';
import { presentRecord } from '../models/ForestRecord.js';
import { parseJson, uuid } from '../validators/recordValidator.js';
import { HttpError } from '../../../shared/errors/HttpError.js';
export class RecordController {
  constructor(repository, publicBaseUrl) {
    this.repository = repository;
    this.service = new RecordService(repository);
    this.publicBaseUrl = publicBaseUrl;
  }
  present = (record) => presentRecord(record, this.publicBaseUrl);
  list = (req, res) =>
    res.set('Cache-Control', 'no-store').json(this.repository.list().map(this.present));
  create = (req, res) =>
    res
      .status(201)
      .json(this.present(this.service.create(parseJson(req.body.record), req.files || [])));
  rename = (req, res) => res.json(this.present(this.service.rename(req.params.id, req.body?.name)));
  productType = (req, res) =>
    res.json(
      this.present(
        this.service.setProductType(req.params.id, req.params.productId, req.body?.productType),
      ),
    );
  finalize = (req, res) =>
    res.json(this.present(this.service.finalize(req.params.id, req.params.action)));
  attempt = (req, res) =>
    res.json(
      this.present(
        this.service.addAttempt(
          req.params.id,
          req.params.productId,
          req.params.phase,
          parseJson(req.body.attempt),
          req.file,
        ),
      ),
    );
  trace = (req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json(presentRecord(this.service.requireRecord(req.params.id), this.publicBaseUrl, true));
  photo = (req, res) => {
    if (!uuid(req.params.attemptId)) throw new HttpError(400, 'Tentativa inválida.');
    const file = this.repository.photo(req.params.id, req.params.attemptId);
    if (!file) throw new HttpError(404, 'Foto não encontrada.');
    res.set('Cache-Control', 'no-store').type(file.mimetype).send(file.buffer);
  };
}
