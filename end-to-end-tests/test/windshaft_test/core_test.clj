(ns windshaft-test.core-test
  (:require [clj-http.client :as http]
            clj-http.conn-mgr
            clojure.stacktrace
            clojure.string
            [cheshire.core :as json]
            [clojure.test :refer [deftest] :as test]
            [clojure.java.jdbc :as jdbc]
            [again.core :as again]))

(defn check-db-is-up [f]
  (again/with-retries
    (again/max-duration 60000 (again/constant-strategy 1000))
    (if (not= 1 (count (jdbc/with-db-connection
                         [conn {:connection-uri "jdbc:postgresql://postgres/test_database?user=anybody&password=password"}]
                         (jdbc/query conn
                                     ["select * from spatial_ref_sys LIMIT 1;"]))))
      (throw (RuntimeException. "Postgres not ready"))))
  (f))

(test/use-fixtures :once check-db-is-up)

(def connection-pool (clj-http.conn-mgr/make-reusable-conn-manager {:timeout 20 :threads 8 :default-per-route 8}))

(def base-url "http://windshaft:4000/test_database/layergroup")

(deftest happy-path
         (let [last-db-update 10000
               response (http/post base-url
                                   {:as                 :json
                                    :connection-manager connection-pool
                                    :headers            {"content-type"     "application/json"
                                                         "x-db-host"        "postgres"
                                                         "x-db-user"        "anybody"
                                                         "x-db-password"    "password"
                                                         "x-db-last-update" last-db-update
                                                         "x-db-port"        "5432"}
                                    :body               (json/generate-string
                                                          {:version "1.5.0",
                                                           :layers  [{:type    "mapnik",
                                                                      :options {:sql              "select instance, geom, yearcons::integer as yearcons from liberia where yearcons ~ '^\\d{4}$';",
                                                                                :geom_column      "geom",
                                                                                :srid             4326,
                                                                                :cartocss         "#s { marker-width: 5; marker-fill:#f45; marker-line-color:#813; marker-allow-overlap:true; marker-fill-opacity: 0.3;} #s[yearcons>=2009] {marker-fill: #1F78B4; marker-line-color: #0000FF;}",
                                                                                :cartocss_version "2.0.0",
                                                                                :interactivity    "instance"}}]})})
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (clojure.test/is (not (clojure.string/blank? layer-group)))
           (clojure.test/is (clojure.string/includes? layer-group ":1000"))
           (let [tile (http/get (str base-url "/" layer-group "/0/0/0/0.grid.json") {:as :json :connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status tile))))
           (let [png (http/get (str base-url "/" layer-group "/10/483/493.png") {:connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status png))))))

"X-Windshaft-Cache"
"Cache-Control"


