(ns windshaft-test.core-test
  (:require [clj-http.client :as http]
            clj-http.conn-mgr
            clojure.stacktrace
            clojure.string
            [cheshire.core :as json]
            [clojure.test :refer [deftest] :as test]
            [clojure.java.jdbc :as jdbc]
            [again.core :as again])
  (:import [javax.crypto Cipher]
           [javax.crypto.spec SecretKeySpec IvParameterSpec]
           [org.apache.commons.codec.binary Base64]
           [org.apache.commons.codec.digest DigestUtils]
           (java.security SecureRandom)))

(defonce ^:private secure-random (SecureRandom.))

(defn random-iv
  "Generate a base64 encoded random byte array of size 16"
  []
  (let [iv-bytes (byte-array 16)]
    (.nextBytes secure-random iv-bytes)
    (Base64/encodeBase64String iv-bytes)))

(defn base64?
  "Returns true if s is a base64 encoded string"
  [s]
  (and (string? s)
       (Base64/isBase64 (.getBytes ^String s))))

(defn encrypt
  "Accepts a string secret, an optional base64 encoded initialization vector (iv)
  and the clear text and returns a base64 encoded byte array."
  ([iv clear-text]
   (encrypt (System/getenv "ENCRYPTION_KEY") iv clear-text))
  ([^String secret ^String iv ^String clear-text]
   {:pre  [(string? secret) (base64? iv) (string? clear-text)]
    :post [(base64? %)]}
   (let [cipher (Cipher/getInstance "AES/CBC/PKCS5Padding")
         key-bytes (DigestUtils/sha256 secret)
         clear-text-bytes (.getBytes clear-text)
         key-spec (SecretKeySpec. key-bytes "AES")
         iv-parameter-spec (IvParameterSpec. (Base64/decodeBase64 iv))
         _ (.init cipher Cipher/ENCRYPT_MODE key-spec iv-parameter-spec)
         output (.doFinal cipher clear-text-bytes)]
     (Base64/encodeBase64String output))))

(defn check-db-is-up [f]
  (again/with-retries
    (again/max-duration 60000 (again/constant-strategy 1000))
    (if (not= 1 (count (jdbc/with-db-connection
                         [conn {:connection-uri "jdbc:postgresql://postgres/test_database?user=anybody&password=password&ssl=true"}]
                         (jdbc/query conn
                                     ["select * from spatial_ref_sys LIMIT 1;"]))))
      (throw (RuntimeException. "Postgres not ready"))))
  (f))

(test/use-fixtures :once check-db-is-up)

(def connection-pool (clj-http.conn-mgr/make-reusable-conn-manager {:timeout 20 :threads 8 :default-per-route 8}))

(def first-instance "http://windshaft:4000/test_database/layergroup")
(def second-instance "http://windshaft2:4000/test_database/layergroup")

(defn create-map [last-db-update]
  (let [iv (random-iv)]
    (http/post first-instance
               {:as                 :json
                :connection-manager connection-pool
                :headers            {"content-type"          "application/json"
                                     "x-db-host"             (encrypt iv "postgres")
                                     "x-db-user"             (encrypt iv "anybody")
                                     "x-db-password"         (encrypt iv "password")
                                     "x-db-last-update"      last-db-update
                                     "x-encrypt-init-vector" iv
                                     "x-db-port"             "5432"}
                :body               (json/generate-string
                                      {:version "1.5.0",
                                       :layers  [{:type    "mapnik",
                                                  :options {:sql              "select instance, geom, yearcons::integer as yearcons from liberia where yearcons ~ '^\\d{4}$';",
                                                            :geom_column      "geom",
                                                            :srid             4326,
                                                            :cartocss         "#s { marker-width: 5; marker-fill:#f45; marker-line-color:#813; marker-allow-overlap:true; marker-fill-opacity: 0.3;} #s[yearcons>=2009] {marker-fill: #1F78B4; marker-line-color: #0000FF;}",
                                                            :cartocss_version "2.0.0",
                                                            :interactivity    "instance"}}]})})))

(deftest happy-path
         (let [last-db-update 10000
               response (create-map last-db-update)
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (clojure.test/is (not (clojure.string/blank? layer-group)))
           (clojure.test/is (clojure.string/includes? layer-group ":1000"))

           (let [tile (http/get (str first-instance "/" layer-group "/0/0/0/0.grid.json") {:as :json :connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status tile)))
             (clojure.test/is (= "max-age=31536000" (get-in tile [:headers "Cache-Control"]))))

           (let [png (http/get (str first-instance "/" layer-group "/10/483/493.png") {:connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status png))))))

(deftest redis-caching-works
         (let [response (create-map (System/currentTimeMillis))
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (let [tile-first-instance (http/get (str first-instance "/" layer-group "/0/11/966/990.grid.json") {:as :json :connection-manager connection-pool})
                 tile-second-instance (http/get (str second-instance "/" layer-group "/0/11/966/990.grid.json") {:as :json :connection-manager connection-pool})]
             (clojure.test/is (= (:body tile-first-instance)
                                 (:body tile-second-instance))))))




